# 🚀 AWS Production Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. **Environment & Security Configuration**

#### ✅ Environment Variables
- [ ] Create `.env.production` file using `env.production.example` as template
- [ ] Generate strong JWT secrets (use crypto.randomBytes(64).toString('hex'))
- [ ] Configure production MongoDB connection string
- [ ] Set up Redis connection details
- [ ] Configure AWS credentials and S3 bucket
- [ ] Set up SMTP email configuration
- [ ] Configure OpenAI API key
- [ ] Set production CLIENT_URL

#### ✅ Security Hardening
- [ ] Remove hardcoded credentials from docker-compose.yml
- [ ] Use AWS Secrets Manager or Parameter Store for sensitive data
- [ ] Enable HTTPS/TLS encryption
- [ ] Configure CORS properly for production domains
- [ ] Set secure cookie options
- [ ] Enable rate limiting for production

### 2. **AWS Infrastructure Setup**

#### ✅ Core Services
- [ ] **EC2 Instance** or **ECS/Fargate** for application hosting
- [ ] **RDS** or **DocumentDB** for MongoDB (if migrating from Atlas)
- [ ] **ElastiCache** for Redis
- [ ] **S3** for file storage
- [ ] **CloudFront** for CDN (optional)
- [ ] **Route 53** for DNS management
- [ ] **Application Load Balancer** for load balancing
- [ ] **VPC** with proper subnets and security groups

#### ✅ Security Groups Configuration
```bash
# Application Security Group (Port 3000)
- Inbound: 3000 from ALB Security Group
- Outbound: All traffic

# ALB Security Group (Port 80, 443)
- Inbound: 80, 443 from 0.0.0.0/0
- Outbound: All traffic

# Database Security Group
- Inbound: 27017 from Application Security Group
- Outbound: All traffic

# Redis Security Group
- Inbound: 6379 from Application Security Group
- Outbound: All traffic
```

### 3. **Database & Caching Setup**

#### ✅ MongoDB
- [ ] Use MongoDB Atlas (recommended) or AWS DocumentDB
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Enable monitoring and alerts
- [ ] Configure proper indexes for performance

#### ✅ Redis (ElastiCache)
- [ ] Set up Redis cluster for high availability
- [ ] Configure authentication
- [ ] Enable encryption in transit and at rest
- [ ] Set up automated backups
- [ ] Configure proper memory settings

### 4. **Application Deployment Options**

#### Option A: EC2 with Docker
```bash
# 1. Launch EC2 instance (t3.medium or larger)
# 2. Install Docker and Docker Compose
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Deploy application
git clone <your-repo>
cd unibuzz-be
cp env.production.example .env.production
# Edit .env.production with actual values
docker-compose -f docker-compose.prod.yml up -d
```

#### Option B: ECS/Fargate (Recommended)
```yaml
# task-definition.json
{
  "family": "unibuzz-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "unibuzz-api",
      "image": "your-ecr-repo/unibuzz-api:latest",
      "portMappings": [{"containerPort": 3000}],
      "environment": [
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"},
        {"name": "MONGODB_URL", "valueFrom": "arn:aws:secretsmanager:region:account:secret:mongodb-url"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/unibuzz-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 5. **CI/CD Pipeline Setup**

#### GitHub Actions (Recommended)
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: unibuzz-api
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -f Dockerfile.prod -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    - name: Deploy to ECS
      uses: aws-actions/amazon-ecs-deploy-task-definition@v1
      with:
        task-definition: task-definition.json
        service: unibuzz-api-service
        cluster: unibuzz-cluster
        wait-for-service-stability: true
```

### 6. **Monitoring & Logging**

#### ✅ CloudWatch Setup
- [ ] Configure application logs to CloudWatch
- [ ] Set up custom metrics for business KPIs
- [ ] Create dashboards for monitoring
- [ ] Set up alarms for critical metrics

#### ✅ Application Monitoring
- [ ] Health check endpoint (`/v1/health`)
- [ ] Performance monitoring (response times, error rates)
- [ ] Database connection monitoring
- [ ] Redis connection monitoring
- [ ] Memory and CPU usage monitoring

### 7. **SSL/TLS Configuration**

#### ✅ Certificate Manager
```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Configure ALB with HTTPS listener
# Redirect HTTP to HTTPS
```

### 8. **Performance Optimization**

#### ✅ Application Level
- [ ] Enable compression (already configured)
- [ ] Implement proper caching headers
- [ ] Optimize database queries
- [ ] Use connection pooling
- [ ] Implement rate limiting

#### ✅ Infrastructure Level
- [ ] Use Application Load Balancer
- [ ] Configure auto-scaling
- [ ] Use CloudFront for static assets
- [ ] Implement proper caching strategies

### 9. **Backup & Disaster Recovery**

#### ✅ Backup Strategy
- [ ] Database automated backups
- [ ] Application code version control
- [ ] Environment configuration backup
- [ ] Regular backup testing

#### ✅ Disaster Recovery
- [ ] Multi-AZ deployment
- [ ] Cross-region backup
- [ ] Recovery procedures documentation
- [ ] Regular DR testing

### 10. **Security Best Practices**

#### ✅ Network Security
- [ ] Use VPC with private subnets
- [ ] Configure security groups properly
- [ ] Enable VPC Flow Logs
- [ ] Use AWS WAF for additional protection

#### ✅ Application Security
- [ ] Regular security updates
- [ ] Dependency vulnerability scanning
- [ ] Input validation and sanitization
- [ ] Proper error handling (no sensitive data exposure)

## 🚀 Deployment Commands

### Quick Start (EC2)
```bash
# 1. Build and run
docker-compose -f docker-compose.prod.yml up -d --build

# 2. Check logs
docker-compose -f docker-compose.prod.yml logs -f

# 3. Health check
curl http://localhost:3000/v1/health
```

### Production Commands
```bash
# Update application
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Monitor application
docker-compose -f docker-compose.prod.yml logs -f app

# Scale application
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## 📊 Monitoring Checklist

- [ ] Application is responding to health checks
- [ ] Database connections are stable
- [ ] Redis connections are working
- [ ] File uploads to S3 are successful
- [ ] Email notifications are being sent
- [ ] Socket.IO connections are working
- [ ] API response times are acceptable
- [ ] Error rates are low
- [ ] Memory usage is within limits
- [ ] CPU usage is reasonable

## 🔧 Troubleshooting

### Common Issues
1. **Connection timeouts**: Check security groups and network configuration
2. **Memory issues**: Increase container memory limits
3. **Database connection errors**: Verify connection strings and network access
4. **Redis connection failures**: Check ElastiCache configuration
5. **SSL certificate issues**: Verify certificate validation and DNS configuration

### Useful Commands
```bash
# Check container status
docker ps -a

# View application logs
docker logs <container-id>

# Check resource usage
docker stats

# Access container shell
docker exec -it <container-id> sh

# Monitor network connections
netstat -tulpn | grep :3000
```

## 📞 Support

For deployment issues:
1. Check CloudWatch logs
2. Verify environment variables
3. Test connectivity between services
4. Review security group configurations
5. Check application health endpoint

Remember to always test in a staging environment before deploying to production! 