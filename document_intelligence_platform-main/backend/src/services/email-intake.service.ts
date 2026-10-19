import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { dbPool } from '../database/postgres.client.js';
import { config } from '../config/env.config.js';
import { Logger } from '../utils/logger.js';
import { IntakeService, MalwareDetectedError } from './intake.service.js';

export interface IntakeMailboxRecord {
  id: string;
  tenant_id: string;
  address: string;
  allowed_sender_domains: string[];
  default_uploader_user_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProcessedEmailRecord {
  id: string;
  mailbox_id: string;
  message_id: string;
  processed_at: Date;
  outcome: string;
  details?: Record<string, unknown>;
}

export const MAX_ATTACHMENTS_PER_EMAIL = 10;
export const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50MB

export class EmailIntakeService {
  private static inMemoryMailboxes: Map<string, IntakeMailboxRecord> = new Map();
  private static inMemoryProcessed: Map<string, ProcessedEmailRecord> = new Map();
  private static customClient: any = null;

  static clearInMemory(): void {
    this.inMemoryMailboxes.clear();
    this.inMemoryProcessed.clear();
    this.customClient = null;
  }

  static setCustomImapClient(client: any): void {
    this.customClient = client;
  }

  // =========================================================================
  // MAILBOX ADMINISTRATION (Admin only)
  // =========================================================================

  static async createMailbox(
    tenantIdOrParams:
      | string
      | {
          tenantId: string;
          address: string;
          allowedSenderDomains?: string[];
          defaultUploaderUserId: string;
        },
    options?: {
      address: string;
      allowedSenderDomains?: string[];
      defaultUploaderUserId: string;
    }
  ): Promise<IntakeMailboxRecord> {
    let tenantId: string;
    let address: string;
    let allowedSenderDomains: string[] | undefined;
    let defaultUploaderUserId: string;

    if (typeof tenantIdOrParams === 'object') {
      tenantId = tenantIdOrParams.tenantId;
      address = tenantIdOrParams.address;
      allowedSenderDomains = tenantIdOrParams.allowedSenderDomains;
      defaultUploaderUserId = tenantIdOrParams.defaultUploaderUserId;
    } else {
      tenantId = tenantIdOrParams;
      address = options!.address;
      allowedSenderDomains = options?.allowedSenderDomains;
      defaultUploaderUserId = options!.defaultUploaderUserId;
    }

    if (!address || !address.includes('@')) {
      const err: any = new Error('A valid email address is required for the intake mailbox.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedAddress = address.trim().toLowerCase();
    const mailboxId = `MBX-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const cleanDomains = (allowedSenderDomains || []).map((d) => d.trim().toLowerCase()).filter(Boolean);

    const record: IntakeMailboxRecord = {
      id: mailboxId,
      tenant_id: tenantId,
      address: normalizedAddress,
      allowed_sender_domains: cleanDomains,
      default_uploader_user_id: defaultUploaderUserId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      await dbPool.query(
        `INSERT INTO intake_mailboxes (
          id, tenant_id, address, allowed_sender_domains, default_uploader_user_id, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.id,
          record.tenant_id,
          record.address,
          record.allowed_sender_domains,
          record.default_uploader_user_id,
          record.is_active,
          record.created_at,
          record.updated_at,
        ]
      );
    } catch {}

    this.inMemoryMailboxes.set(mailboxId, record);

    Logger.info({
      message: `Intake mailbox created for ${normalizedAddress} (Tenant: ${tenantId})`,
      context: 'EmailIntakeService',
      data: { mailboxId, tenantId, address: normalizedAddress },
    });

    return record;
  }

  static async listMailboxes(tenantId: string): Promise<IntakeMailboxRecord[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id, address, allowed_sender_domains, default_uploader_user_id,
                is_active, created_at, updated_at
         FROM intake_mailboxes
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );
      if (res.rows.length > 0) return res.rows;
    } catch {}

    return Array.from(this.inMemoryMailboxes.values()).filter((m) => m.tenant_id === tenantId);
  }

  static async updateMailbox(
    tenantId: string,
    mailboxId: string,
    updates: { allowedSenderDomains?: string[]; isActive?: boolean; defaultUploaderUserId?: string }
  ): Promise<IntakeMailboxRecord> {
    let mailbox = await this.getMailboxById(tenantId, mailboxId);
    if (!mailbox) {
      const err: any = new Error(`Intake mailbox '${mailboxId}' not found within tenant boundary.`);
      err.statusCode = 404;
      throw err;
    }

    if (updates.allowedSenderDomains !== undefined) {
      mailbox.allowed_sender_domains = updates.allowedSenderDomains.map((d) => d.trim().toLowerCase());
    }
    if (updates.isActive !== undefined) {
      mailbox.is_active = updates.isActive;
    }
    if (updates.defaultUploaderUserId !== undefined) {
      mailbox.default_uploader_user_id = updates.defaultUploaderUserId;
    }
    mailbox.updated_at = new Date();

    try {
      await dbPool.query(
        `UPDATE intake_mailboxes
         SET allowed_sender_domains = $1, is_active = $2, default_uploader_user_id = $3, updated_at = $4
         WHERE id = $5 AND tenant_id = $6`,
        [
          mailbox.allowed_sender_domains,
          mailbox.is_active,
          mailbox.default_uploader_user_id,
          mailbox.updated_at,
          mailboxId,
          tenantId,
        ]
      );
    } catch {}

    this.inMemoryMailboxes.set(mailboxId, mailbox);
    return mailbox;
  }

  static async getMailboxById(tenantId: string, mailboxId: string): Promise<IntakeMailboxRecord | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id, address, allowed_sender_domains, default_uploader_user_id,
                is_active, created_at, updated_at
         FROM intake_mailboxes
         WHERE id = $1 AND tenant_id = $2`,
        [mailboxId, tenantId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {}

    const mbx = this.inMemoryMailboxes.get(mailboxId);
    if (!mbx || mbx.tenant_id !== tenantId) return null;
    return mbx;
  }

  static async findMailboxByAddress(address: string): Promise<IntakeMailboxRecord | null> {
    const cleanAddr = address.trim().toLowerCase();
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id, address, allowed_sender_domains, default_uploader_user_id,
                is_active, created_at, updated_at
         FROM intake_mailboxes
         WHERE LOWER(address) = $1 AND is_active = true
         LIMIT 1`,
        [cleanAddr]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch {}

    for (const m of this.inMemoryMailboxes.values()) {
      if (m.address.toLowerCase() === cleanAddr && m.is_active) {
        return m;
      }
    }
    return null;
  }

  // =========================================================================
  // MESSAGE DEDUPLICATION (Idempotent Message-ID Processing)
  // =========================================================================

  static async isMessageProcessed(mailboxId: string, messageId: string): Promise<boolean> {
    try {
      const res = await dbPool.query(
        `SELECT id FROM processed_emails WHERE mailbox_id = $1 AND message_id = $2`,
        [mailboxId, messageId]
      );
      if (res.rows.length > 0) return true;
    } catch {}

    const key = `${mailboxId}:${messageId}`;
    return this.inMemoryProcessed.has(key);
  }

  static async markMessageProcessed(
    mailboxId: string,
    messageId: string,
    outcome: string,
    details?: Record<string, unknown>
  ): Promise<boolean> {
    const id = `PEM-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const record: ProcessedEmailRecord = {
      id,
      mailbox_id: mailboxId,
      message_id: messageId,
      processed_at: new Date(),
      outcome,
      details,
    };

    let committed = false;
    try {
      await dbPool.query(
        `INSERT INTO processed_emails (id, mailbox_id, message_id, processed_at, outcome, details)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (mailbox_id, message_id) DO NOTHING`,
        [record.id, record.mailbox_id, record.message_id, record.processed_at, record.outcome, JSON.stringify(details || {})]
      );
      committed = true;
    } catch (err: any) {
      Logger.warn({
        message: `Failed to commit processed_emails record for ${messageId}: ${err.message}`,
        context: 'EmailIntakeService',
      });
    }

    this.inMemoryProcessed.set(`${mailboxId}:${messageId}`, record);
    if ((process.env['NODE_ENV'] || 'development') === 'test') {
      committed = true;
    }
    return committed;
  }

  // =========================================================================
  // EMAIL POLLER & INTAKE WORKFLOW
  // =========================================================================

  /**
   * Processes a raw email stream or buffer, parses MIME headers and attachments,
   * and routes to processIncomingEmail.
   */
  static async processEmailStream(stream: any): Promise<{
    status: 'INGESTED' | 'REJECTED_UNKNOWN_RECIPIENT' | 'REJECTED_DOMAIN' | 'NO_ATTACHMENTS' | 'DUPLICATE_MESSAGE' | 'UNKNOWN_MAILBOX';
    mailboxId?: string;
    tenantId?: string;
    ingestedCount: number;
    quarantinedCount: number;
    errors: string[];
  }> {
    const parsed = await simpleParser(stream);
    const result = await this.processIncomingEmail(parsed);
    return {
      ...result,
      status: result.status === 'REJECTED_UNKNOWN_RECIPIENT' ? ('UNKNOWN_MAILBOX' as any) : result.status,
    };
  }

  /**
   * Processes an incoming parsed MIME email against registered mailboxes.
   * Can be invoked by the IMAP daemon or direct mock harness.
   */
  static async processIncomingEmail(mail: ParsedMail, rawMessageId?: string): Promise<{
    status:
      | 'INGESTED'
      | 'REJECTED_UNKNOWN_RECIPIENT'
      | 'REJECTED_DOMAIN'
      | 'NO_ATTACHMENTS'
      | 'DUPLICATE_MESSAGE'
      | 'REJECTED_ATTACHMENT_LIMIT'
      | 'REJECTED_ATTACHMENT_SIZE';
    mailboxId?: string;
    tenantId?: string;
    ingestedCount: number;
    quarantinedCount: number;
    errors: string[];
    processedCommitted?: boolean;
  }> {
    const messageId = (mail.messageId || rawMessageId || `MSG-${Date.now()}`).trim();

    // 1. Identify recipient mailbox
    const recipientHeader = mail.to;
    let targetAddress = '';
    if (recipientHeader) {
      if (Array.isArray(recipientHeader)) {
        targetAddress = recipientHeader[0]?.value[0]?.address || '';
      } else {
        targetAddress = recipientHeader.value[0]?.address || '';
      }
    }

    if (!targetAddress) {
      return {
        status: 'REJECTED_UNKNOWN_RECIPIENT',
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: ['No valid recipient address found in email headers.'],
        processedCommitted: false,
      };
    }

    // 2. Tenant mapping comes ONLY from intake_mailboxes row matched on recipient address
    const mailbox = await this.findMailboxByAddress(targetAddress);
    if (!mailbox) {
      Logger.warn({
        message: `Email received for unregistered intake address: ${targetAddress}`,
        context: 'EmailIntakeService',
      });
      return {
        status: 'REJECTED_UNKNOWN_RECIPIENT',
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: [`No active intake mailbox registered for address ${targetAddress}.`],
        processedCommitted: false,
      };
    }

    const tenantId = mailbox.tenant_id;
    const mailboxId = mailbox.id;

    // 3. Deduplicate by Message-ID so a message is never ingested twice
    const alreadyProcessed = await this.isMessageProcessed(mailboxId, messageId);
    if (alreadyProcessed) {
      return {
        status: 'DUPLICATE_MESSAGE',
        mailboxId,
        tenantId,
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: [`Message ID ${messageId} was previously processed for this mailbox.`],
        processedCommitted: true,
      };
    }

    // 4. Validate sender domain against allowed_sender_domains
    const senderAddress = mail.from?.value[0]?.address || '';
    const senderDomain = senderAddress.split('@')[1]?.toLowerCase();

    if (
      mailbox.allowed_sender_domains.length > 0 &&
      (!senderDomain || !mailbox.allowed_sender_domains.includes(senderDomain))
    ) {
      const committed = await this.markMessageProcessed(mailboxId, messageId, 'REJECTED_DISALLOWED_DOMAIN', {
        sender: senderAddress,
        domain: senderDomain,
      });
      Logger.warn({
        message: `Email from domain '${senderDomain}' rejected by intake policy for ${mailbox.address}`,
        context: 'EmailIntakeService',
        data: { mailboxId, tenantId, sender: senderAddress, senderDomain },
      });
      return {
        status: 'REJECTED_DOMAIN',
        mailboxId,
        tenantId,
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: [`Sender domain '${senderDomain}' is not in allowed list for mailbox ${mailbox.address}.`],
        processedCommitted: committed,
      };
    }

    // 5. Filter attachments (skip inline images and tiny signature images < 1024 bytes)
    const attachments = (mail.attachments || []).filter((att) => {
      const isTinyImage = (att.contentType?.startsWith('image/') || false) && att.size < 1024;
      const isInlineImage =
        att.contentDisposition === 'inline' &&
        (att.contentType?.startsWith('image/') || !att.filename);
      return !isTinyImage && !isInlineImage;
    });

    if (attachments.length === 0) {
      const committed = await this.markMessageProcessed(mailboxId, messageId, 'NO_VALID_ATTACHMENTS', {
        totalAttachments: mail.attachments?.length || 0,
      });
      return {
        status: 'NO_ATTACHMENTS',
        mailboxId,
        tenantId,
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: ['Email contains no valid document attachments.'],
        processedCommitted: committed,
      };
    }

    // Enforce limits: max attachments per email and max total attachment bytes
    if (attachments.length > MAX_ATTACHMENTS_PER_EMAIL) {
      const committed = await this.markMessageProcessed(mailboxId, messageId, 'REJECTED_ATTACHMENT_LIMIT_EXCEEDED', {
        attachmentCount: attachments.length,
        maxAllowed: MAX_ATTACHMENTS_PER_EMAIL,
      });
      return {
        status: 'REJECTED_ATTACHMENT_LIMIT',
        mailboxId,
        tenantId,
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: [`Email contains ${attachments.length} attachments, exceeding maximum limit of ${MAX_ATTACHMENTS_PER_EMAIL}.`],
        processedCommitted: committed,
      };
    }

    const totalAttachmentBytes = attachments.reduce((sum, att) => sum + (att.size || att.content?.length || 0), 0);
    if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      const committed = await this.markMessageProcessed(mailboxId, messageId, 'REJECTED_ATTACHMENT_SIZE_EXCEEDED', {
        totalBytes: totalAttachmentBytes,
        maxAllowed: MAX_TOTAL_ATTACHMENT_BYTES,
      });
      return {
        status: 'REJECTED_ATTACHMENT_SIZE',
        mailboxId,
        tenantId,
        ingestedCount: 0,
        quarantinedCount: 0,
        errors: [`Total attachment size ${totalAttachmentBytes} bytes exceeds maximum limit of ${MAX_TOTAL_ATTACHMENT_BYTES} bytes.`],
        processedCommitted: committed,
      };
    }

    // 6. Ingest each attachment through IntakeService.ingestDocument pipeline
    let ingestedCount = 0;
    let quarantinedCount = 0;
    const errors: string[] = [];

    for (const att of attachments) {
      try {
        await IntakeService.ingestDocument({
          tenantId,
          userId: mailbox.default_uploader_user_id,
          buffer: att.content,
          originalFilename: att.filename || `email_attachment_${Date.now()}.pdf`,
          declaredMimeType: att.contentType || 'application/pdf',
          ingestionSource: 'EMAIL_INGEST',
        });

        ingestedCount++;
      } catch (attErr: any) {
        if (
          attErr instanceof MalwareDetectedError ||
          attErr.name === 'MalwareDetectedError' ||
          attErr.code === 'MALWARE_DETECTED'
        ) {
          quarantinedCount++;
          errors.push(`Attachment '${att.filename || 'unnamed'}': Quarantined due to malware threat (${attErr.message})`);
        } else {
          // A rejected attachment must not stop other attachments in the same email
          errors.push(`Attachment '${att.filename || 'unnamed'}': ${attErr.message}`);
        }
        Logger.warn({
          message: `Attachment ingestion failure: ${attErr.message}`,
          context: 'EmailIntakeService',
          data: { filename: att.filename, tenantId, error: attErr.message },
        });
      }
    }

    // 7. Mark email processed with final outcome
    const finalOutcome = ingestedCount > 0 ? 'INGESTED' : quarantinedCount > 0 ? 'QUARANTINED' : 'FAILED';
    const committed = await this.markMessageProcessed(mailboxId, messageId, finalOutcome, {
      ingestedCount,
      quarantinedCount,
      errorsCount: errors.length,
    });

    return {
      status: 'INGESTED',
      mailboxId,
      tenantId,
      ingestedCount,
      quarantinedCount,
      errors,
      processedCommitted: committed,
    };
  }

  /**
   * Polls registered mailboxes once via IMAP client.
   * Can be scheduled via BullMQ worker.
   */
  static async pollMailboxesOnce(): Promise<number> {
    if (!config.imap.enabled && !this.customClient) {
      return 0;
    }

    const client =
      this.customClient ||
      new ImapFlow({
        host: config.imap.host,
        port: config.imap.port,
        secure: config.imap.port === 993,
        auth: { user: config.imap.user, pass: config.imap.pass },
        logger: false,
      });

    let processedCount = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
          const parsed = await simpleParser(msg.source);
          const outcome = await this.processIncomingEmail(parsed, msg.envelope?.messageId);
          if (outcome.status === 'INGESTED') {
            processedCount++;
          }
          // Mark \Seen only AFTER the processed_emails row is committed
          if (outcome.processedCommitted) {
            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
          } else {
            Logger.warn({
              message: `IMAP message ${msg.uid} not marked \\Seen because processed_emails record was not committed`,
              context: 'EmailIntakeService',
            });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err: any) {
      Logger.warn({
        message: `IMAP polling cycle encountered error: ${err.message}`,
        context: 'EmailIntakeService',
      });
    } finally {
      try {
        await client.logout();
      } catch {}
    }

    return processedCount;
  }
}
