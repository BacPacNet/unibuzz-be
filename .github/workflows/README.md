# GitHub Actions - Amazon ECR Deployment

This workflow automatically builds and pushes Docker images to Amazon ECR when code is merged to the main branch.

## Prerequisites

1. **AWS Account**: You need an AWS account with ECR access
2. **ECR Repository**: Create an ECR repository in your AWS account
3. **AWS IAM User**: Create an IAM user with ECR permissions
4. **GitHub Secrets**: Add AWS credentials to your GitHub repository secrets

## Setup Instructions

### 1. Create ECR Repository

In your AWS Console:

1. Go to Amazon ECR
2. Click "Create repository"
3. Enter repository name: `unibuzz-api` (or your preferred name)
4. Set repository permissions as needed
5. Note the repository URI

### 2. Create IAM User for GitHub Actions

Create an IAM user with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. Add GitHub Secrets

In your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `AWS_ACCESS_KEY_ID`: Your IAM user access key
   - `AWS_SECRET_ACCESS_KEY`: Your IAM user secret key

### 4. Configure Workflow

Update the workflow file `.github/workflows/deploy-to-ecr.yml`:

1. Change `AWS_REGION` to your preferred region
2. Change `ECR_REPOSITORY` to match your ECR repository name

## Workflow Details

The workflow consists of two jobs:

### Test Job

- Runs on every push to main
- Installs dependencies
- Runs tests and linting
- Must pass before build job starts

### Build and Push Job

- Only runs on main branch
- Requires test job to pass
- Authenticates with AWS
- Builds Docker image
- Pushes to ECR with two tags:
  - Git commit SHA
  - `latest`

## Environment Variables

| Variable         | Description         | Default       |
| ---------------- | ------------------- | ------------- |
| `AWS_REGION`     | AWS region for ECR  | `us-east-1`   |
| `ECR_REPOSITORY` | ECR repository name | `unibuzz-api` |

## Troubleshooting

### Common Issues

1. **Authentication Failed**: Check your AWS credentials in GitHub secrets
2. **Repository Not Found**: Verify ECR repository name and region
3. **Permission Denied**: Ensure IAM user has proper ECR permissions
4. **Build Failed**: Check Dockerfile and dependencies

### Debug Steps

1. Check workflow logs in GitHub Actions
2. Verify AWS credentials are correct
3. Test ECR access manually with AWS CLI
4. Ensure repository exists in specified region

## Security Notes

- Never commit AWS credentials to your repository
- Use IAM roles with minimal required permissions
- Regularly rotate access keys
- Consider using OIDC for better security (advanced setup)
