# AWS deployment

ChessDesk uses the same CloudFormation template for two independent stacks:

- `chessdesk-ec2` is the existing dev environment. It keeps its current EC2
  instance and data volume.
- `chessdesk-ec2-prod` is the production environment. It gets its own EC2
  instance, CloudFront distribution, security group, and retained encrypted
  SQLite EBS volume. It starts with a fresh database; dev data is not copied.

The stacks share the configured VPC and subnet. Their app instances, security
groups, distributions, and databases are separate.

Each stack has a distinct CloudFront HTTPS URL. Deleting either stack retains
that stack's data volume, which remains billable until separately deleted.

GitHub Actions deploys successful `main` pushes to dev. To deploy production,
run the `CI/CD` workflow from `main` and select `prod` for `target_environment`.
The deploy script runs through Systems Manager, waits for the new container's
health check, and restores the previous container if the new one fails. No SSH
key or inbound SSH rule is used.

## One-time AWS setup

The workflow defaults to region `af-south-1`, dev stack `chessdesk-ec2`, and
production stack `chessdesk-ec2-prod`. Repository variables `AWS_REGION`,
`AWS_DEV_STACK_NAME`, and `AWS_PROD_STACK_NAME` can override those values. The
legacy `AWS_STACK_NAME` variable remains a fallback for dev.

1. Ensure the AWS account has the GitHub OIDC identity provider
   `https://token.actions.githubusercontent.com`, with audience `sts.amazonaws.com`.
   If it is missing, create it once:

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. Apply the template to the existing dev stack and create the independent
   production stack. The dev update adds its `Environment=dev` tag; it does not
   replace the stack's existing instance or data volume.

   ```sh
   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2 \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides Environment=dev

   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2-prod \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides Environment=prod
   ```

   The template defaults to the VPC, subnet, Availability Zone, CloudFront
   prefix list, and Amazon Linux AMI in `af-south-1`. Override those parameters
   together if using another region or network.

3. Deploy or update `github-actions-role.yaml` in the same region. The role is
   scoped to read outputs from the dev and production stacks, and can send SSM
   commands only to ChessDesk instances tagged for one of those environments.
   The default OIDC subject allows the `main` branch of
   `Eleazarovich/chessdesk`:

   ```sh
   aws cloudformation deploy \
     --template-file deploy/github-actions-role.yaml \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       GitHubOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com \
       ChessDeskDevStackName=chessdesk-ec2 \
       ChessDeskProdStackName=chessdesk-ec2-prod
   ```

   If the repository is transferred or GitHub shows a different exact OIDC
   subject, pass that value as `GitHubSubject`. The workflow is branch based.

4. Set the GitHub repository secret `AWS_ROLE_ARN` to the role stack's
   `RoleArn` output. With GitHub CLI authenticated, this command writes it:

   ```sh
   aws cloudformation describe-stacks \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_ROLE_ARN --repo Eleazarovich/chessdesk
   ```

   If the role stack already exists, updating it keeps the role ARN stable, so
   the existing repository secret remains valid. The workflow stops with a
   setup link if `AWS_ROLE_ARN` is missing.

Pull requests run the backend, frontend, Compose integration, and Playwright
E2E checks without AWS credentials. A push to `main` deploys dev only after all
checks pass. A manual production run also waits for all checks and is allowed
only when run from `main`.
