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

The backend exports OpenTelemetry request and SQLAlchemy spans, HTTP request and
SQLAlchemy connection metrics when an OTLP endpoint is configured in the
container. Every telemetry signal includes the
`chessdesk-backend` service name, the `dev` or `production` deployment
environment, and the full deployed Git commit SHA as `service.version`.

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
   ChessDesk instances tagged for either environment. The role trusts the
   immutable OIDC subjects for `main`, `dev`, and `production`. Restrict the
   GitHub `dev` and `production` environments to the `main` branch and disable
   administrator bypass:

   ```sh
   aws cloudformation deploy \
     --template-file deploy/github-actions-role.yaml \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       GitHubOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com \
       GitHubSubject=repo:Eleazarovich@96009758/chessdesk@1358729767:ref:refs/heads/main \
       GitHubDevEnvironmentSubject=repo:Eleazarovich@96009758/chessdesk@1358729767:environment:dev \
       GitHubProductionEnvironmentSubject=repo:Eleazarovich@96009758/chessdesk@1358729767:environment:production \
       ChessDeskDevStackName=chessdesk-ec2 \
       ChessDeskProdStackName=chessdesk-ec2-prod
   ```

   For an existing role stack, rerun this command after updating the image
   pipeline. Updating repository code alone does not update the AWS role policy.

   If GitHub reports different OIDC subjects for the branch or environments,
   pass them using the matching parameters. The workflow job environments must
   remain restricted to `main` so environment subjects cannot be used by other
   branches.

3. Apply the template to the existing dev stack and create the independent
   production stack. The dev update adds its `Environment=dev` tag; it does not
   replace the stack's existing instance or data volume. The template also
   publishes each environment's app security group ID for the observability
   stack.

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

4. Deploy the observability stack separately. It uses the app stacks' VPC,
   subnet, Availability Zone, and security-group outputs. No public inbound
   rules are created; dev and production can send OTLP gRPC to the private DNS
   name `otel.chessdesk.internal`, while Grafana and Prometheus are available
   only on the host's loopback interface.

   ```sh
   vpc_id="$(aws cloudformation describe-stacks --stack-name chessdesk-ec2 --region af-south-1 --query "Stacks[0].Parameters[?ParameterKey=='VpcId'].ParameterValue | [0]" --output text)"
   subnet_id="$(aws cloudformation describe-stacks --stack-name chessdesk-ec2 --region af-south-1 --query "Stacks[0].Parameters[?ParameterKey=='PublicSubnetId'].ParameterValue | [0]" --output text)"
   availability_zone="$(aws cloudformation describe-stacks --stack-name chessdesk-ec2 --region af-south-1 --query "Stacks[0].Parameters[?ParameterKey=='AvailabilityZone'].ParameterValue | [0]" --output text)"
   dev_app_security_group="$(aws cloudformation describe-stacks --stack-name chessdesk-ec2 --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='OriginSecurityGroupId'].OutputValue | [0]" --output text)"
   prod_app_security_group="$(aws cloudformation describe-stacks --stack-name chessdesk-ec2-prod --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='OriginSecurityGroupId'].OutputValue | [0]" --output text)"

   aws cloudformation deploy \
     --template-file deploy/observability-ec2.yaml \
     --stack-name chessdesk-observability \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       VpcId="$vpc_id" \
       PublicSubnetId="$subnet_id" \
       AvailabilityZone="$availability_zone" \
       DevAppSecurityGroupId="$dev_app_security_group" \
       ProdAppSecurityGroupId="$prod_app_security_group" \
       GitRef=main
   ```

   The instance has a public address for outbound package and image downloads,
   but its security group has no public ingress. OTLP gRPC is allowed only from
   the two app security groups. The stack generates the Grafana admin password
   in Secrets Manager and exports only its secret ARN.

   Attach the `GrafanaAccessPolicyArn` output only to approved IAM roles or
   groups. This policy grants an SSM tunnel to Grafana port 3000 and permission
   to read its password; it does not grant shell access or Run Command. For an
   approved IAM role, for example:

   ```sh
   grafana_access_policy="$(aws cloudformation describe-stacks --stack-name chessdesk-observability --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='GrafanaAccessPolicyArn'].OutputValue | [0]" --output text)"
   aws iam attach-role-policy --role-name APPROVED_ROLE_NAME --policy-arn "$grafana_access_policy"
   ```

   An operator with that policy can retrieve the password using the
   `GrafanaAdminPasswordSecretArn` stack output, then start the tunnel:

   ```sh
   grafana_instance="$(aws cloudformation describe-stacks --stack-name chessdesk-observability --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue | [0]" --output text)"
   grafana_document="$(aws cloudformation describe-stacks --stack-name chessdesk-observability --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='GrafanaPortForwardingDocument'].OutputValue | [0]" --output text)"
   grafana_secret="$(aws cloudformation describe-stacks --stack-name chessdesk-observability --region af-south-1 --query "Stacks[0].Outputs[?OutputKey=='GrafanaAdminPasswordSecretArn'].OutputValue | [0]" --output text)"
   aws secretsmanager get-secret-value --secret-id "$grafana_secret" --region af-south-1 --query SecretString --output text
   aws ssm start-session --target "$grafana_instance" --document-name "$grafana_document" --parameters '{"localPortNumber":["3000"]}' --region af-south-1
   ```

   While the SSM session is running, open <http://127.0.0.1:3000> and sign in
   as `admin` with the retrieved password. Session Manager access is controlled
   by IAM and recorded by CloudTrail.

5. Set the GitHub repository secret `AWS_ROLE_ARN` to the role stack's
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
