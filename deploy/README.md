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

GitHub Actions builds the application image after the checks pass, pushes it to
the shared ECR repository, then deploys that image to dev. ECR rejects tag
overwrites. Tags use the UTC
`YYYYMMDD-HHMMSS-shortsha` format, for example `20260818-163457-83242da`.
Production promotion is manual: run `Promote dev to production` from `main` and
select `promote`. It checks the running dev container's health, reads its ECR
image tag and full source commit, then pulls and deploys that exact image to
production through Systems Manager. The production deploy waits for the new
container's health check and restores the previous container if the new one
fails. The workflow also checks the public production health endpoint. No SSH
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

2. Deploy `github-actions-role.yaml` in the same region. It creates the shared
   ECR repository and a role that can push images and send SSM commands only to
   ChessDesk instances tagged for either environment. The default OIDC subject
   allows the `main` branch of `Eleazarovich/chessdesk`:

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

   For an existing role stack, rerun this command after updating the image
   pipeline. Updating repository code alone does not update the AWS role policy.

   If the repository is transferred or GitHub shows a different exact OIDC
   subject, pass that value as `GitHubSubject`. The workflow is branch based.

3. Apply the template to the existing dev stack and create the independent
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
   together if using another region or network. A newly created environment
   waits for its first image deployment; CloudFormation no longer builds or
   starts an application image on EC2.

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
E2E checks without AWS credentials. A push to `main` builds and pushes one
timestamped image, then deploys it to dev only after all checks pass. Production
promotion is a separate manual workflow and is allowed only from `main`; it
promotes the image currently running in dev when the workflow runs, regardless
of the commit used to start the workflow. After setting up or updating these
resources, run CI/CD from `main` (push or `workflow_dispatch`) to deploy a new
timestamped image to dev before using the promotion workflow.
