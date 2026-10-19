# 🐹 DocuNexa Backend Development & Go Microservices Specification

**Target Backend Tech Stack:**
- **Language:** Go (Golang 1.22+)
- **HTTP Framework:** Gin-Gonic / Fiber
- **Relational Storage:** PostgreSQL 16 (GORM / pgx driver)
- **Unstructured / Document Storage:** MongoDB 7.0 (Official Go mongo-driver)
- **Caching & Event Outbox:** Redis 7.2 (go-redis)
- **Object Storage:** AWS S3 / MinIO (AWS SDK for Go v2)
- **Authentication:** OAuth2 / JWT (golang-jwt/jwt/v5)

---

## 1. 📂 Microservice Project Structure

```
docunexa-backend/
├── cmd/
│   ├── api-gateway/        # Main REST API Gateway (Port 8080)
│   ├── ingestion-service/  # Async Queue Consumer & S3 Watcher (Port 8081)
│   ├── ocr-processor/      # Layout Parser & ML Inference Worker (Port 8082)
│   └── report-engine/      # CSV/PDF Generation & SHA-256 Audit Sealer (Port 8083)
├── internal/
│   ├── config/             # Environment & Vault Secrets Loader
│   ├── domain/             # Go Struct Models (Document, AuditEvent, Tenant)
│   ├── handler/            # HTTP Controller Handlers (Gin routes)
│   ├── middleware/         # Auth, RBAC, Rate Limiter, CORS, Audit Interceptor
│   ├── repository/         # Postgres & MongoDB Query Data Access Layer
│   └── service/            # Business Logic & Workflow Engine
├── migrations/             # PostgreSQL SQL Schema Migration Files (.sql)
├── pkg/                    # Shared Crypto & SHA-256 Utility Packages
├── docker-compose.yml
├── Dockerfile
└── go.mod
```

---

## 2. 🔐 Key Go Implementations

### 1. Cryptographic SHA-256 Audit Sealer (`pkg/crypto/audit_sealer.go`)
```go
package crypto

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// GenerateAuditSeal signs event data with HMAC SHA-256 for immutable governance logs
func GenerateAuditSeal(secretKey string, eventPayload string) string {
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(eventPayload))
	return hex.EncodeToString(h.Sum(nil))
}
```

### 2. Document Verification Handler (`internal/handler/document_handler.go`)
```go
package handler

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

type FieldCorrectionRequest struct {
	FieldKey       string `json:"fieldKey" binding:"required"`
	CorrectedValue string `json:"correctedValue" binding:"required"`
	OverrideReason string `json:"overrideReason" binding:"required"`
}

func VerifyFieldHandler(c *gin.Context) {
	docID := c.Param("id")
	var req FieldCorrectionRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	reviewerID := c.GetString("userId")
	// Save correction to Postgres + Log Audit Event
	c.JSON(http.StatusOK, gin.H{
		"message": "Field verified successfully",
		"documentId": docID,
		"fieldKey": req.FieldKey,
		"reviewerId": reviewerID,
	})
}
```

---

## 3. 🚀 Database Connection Setup

- **PostgreSQL Connection String:**  
  `postgres://docunexa_user:SecretPassword123@localhost:5432/docunexa_db?sslmode=disable`

- **MongoDB Connection String:**  
  `mongodb://docunexa_mongo:SecretPassword123@localhost:27017/docunexa_nosql?authSource=admin`

- **Redis Connection:**  
  `localhost:6379` (DB: `0`)
