# Deployment Architecture Specification — Cloud & Kubernetes

## Production Topology
DocuNexa is deployed as a highly available, multi-zone Kubernetes (EKS / GKE) cluster:

```mermaid
flowchart TD
    Internet((Internet)) --> ALB[Application Load Balancer]
    subgraph K8sCluster ["Kubernetes Production Cluster"]
        ALB --> IngressCtrl[Traefik / NGINX Ingress Controller]
        IngressCtrl --> WebPods[Angular SSR Pods (x4)]
        IngressCtrl --> ApiPods[Node.js API Gateway Pods (x6)]
        
        ApiPods --> RedisQueue[(Redis Queue Cluster)]
        RedisQueue --> WorkerPods[AI Worker Pods (Autoscaling x4 - x16)]
    end

    subgraph ManagedCloud ["Managed Cloud Services"]
        ApiPods --> CloudSQL[(Managed PostgreSQL 16 Multi-AZ)]
        WorkerPods --> CloudSQL
        WorkerPods --> S3Storage[(AWS S3 / GCS Encrypted Bucket)]
    end
```

---

## Deployment Strategy
* **Zero-Downtime Deployments**: Blue-Green and Rolling updates with Kubernetes readiness and liveness probes.
* **Autoscaling Policies**: Horizontal Pod Autoscaler (HPA) scaling worker nodes based on BullMQ queue latency.
