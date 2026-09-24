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

Current viewer URLs are <https://d1bqcmvdafa6rq.cloudfront.net> (dev) and
<https://d2mo1cbaii74n0.cloudfront.net> (production). Origin TLS does not require
changing these public addresses.

## Security upgrade and origin certificates

The security upgrade is a coordinated application, workflow, and IAM change.
Review it locally before updating AWS. Do not purchase a domain or certificate,
create billable resources, or start a chargeable deployment without the owner's
approval. This configuration reuses the existing EC2 instance, EBS volume,
security group, and CloudFront distribution; it adds no load balancer or secret
storage service.

CloudFront connects to the origin using HTTPS on port 8000. Each environment
needs an origin hostname you control, such as `origin-dev.example.com`, with
a publicly trusted certificate for that hostname. The `cloudfront.net` viewer
certificate cannot be installed on EC2, and CloudFront does not accept a
self-signed origin certificate. An ACME certificate can be free when an
appropriate domain is already available; obtain approval before any purchase.

The owner currently uses only the AWS viewer addresses and has no custom
domain. Origin TLS rollout therefore remains pending. A domain purchase is
optional: a free subdomain from [DuckDNS](https://www.duckdns.org/about.jsp)
and a free [Let's Encrypt certificate](https://letsencrypt.org/getting-started/)
can provide the origin hostname and certificate while retaining the public
CloudFront addresses. This requires a DuckDNS account, DNS setup, and
certificate renewal, and adds a dependency on that third-party DNS service.
No account, DNS record, or public certificate is created by these code changes.

Before deploying the updated application:

1. Provision each origin hostname's DNS CNAME to its EC2 public DNS name
   (`OriginDnsTarget` after the template update; available from EC2 beforehand).
   A DNS A record pointing to the instance's public IPv4 address also works;
   use that option with DuckDNS and update it if the instance's IP changes.
   Do not point the origin hostname at the CloudFront viewer URL.
2. Obtain a certificate, preferably using DNS validation so no public HTTP or
   SSH ingress needs to be opened. Transfer its PEM full certificate chain and
   unencrypted private key through an approved secure operator channel to the
   existing host's encrypted EBS volume as
   `/data/chessdesk-tls/fullchain.pem` and `/data/chessdesk-tls/privkey.pem`.
   Keep the directory at mode 0700 and files at 0600, owned by UID/GID 10001.
   Keep keys out of git, shell command arguments, SSM command bodies, and logs.
   Ensure the host has the `openssl` command for certificate checks.
3. Apply the IAM template and configure the three role secrets described
   below. The old shared role becomes build-only; code changes alone do not
   revoke its permissions in AWS.
4. Coordinate a maintenance window to apply `OriginDomainName` to each app
   stack and deploy the corresponding TLS-enabled image. Switching CloudFront
   before the matching TLS listener is running produces 502 responses until
   the image deployment completes. Validate dev before performing this change
   in production. The updated workflow refuses to deploy without the new
   origin output, and the deployment script verifies the certificate chain, hostname,
   key match, and at least 24 hours of validity before stopping the old image.
5. Check the public `/health` endpoint and sign in again. Legacy application
   sessions are invalidated by the expiry migration; business data is retained.

Certificate renewal is an operator responsibility: renew and securely replace
the two PEM files, then redeploy or restart the application to load the renewed
certificate before it expires. Keep a private backup of the previous valid
certificate when rotating; a container rollback uses the mounted certificate
directory. Update the DNS record if an instance replacement changes its public
DNS name. The origin security group must remain restricted to CloudFront's
managed prefix list for the trusted viewer IP rate limits to be valid.

CloudFront origin TLS requirements: [AWS documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-cloudfront-to-custom-origin.html).

Local deployment checks, using installed tools:

```sh
cfn-lint deploy/chessdesk-ec2.yaml deploy/github-actions-role.yaml
cfn-guard validate --rules deploy/security.guard \
  --data deploy/chessdesk-ec2.yaml --data deploy/github-actions-role.yaml \
  --output-format json
bash -n deploy/deploy-ec2.sh
bash -n deploy/validate-origin-tls.sh
```

The Guard rules cover origin encryption and the audited role boundaries.
For a broader compliance review, download the relevant rules from the
[AWS Guard rules registry](https://github.com/aws-cloudformation/aws-guard-rules-registry).

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
   ECR repository and three roles: the main-branch build role can publish images;
   the dev environment role can run commands only on dev instances; and the
   production environment role can inspect the running dev release and deploy
   production. Only the protected production subject can obtain production
   command permissions. Restrict the
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

3. After preparing certificates and DNS as described above, apply the app
   template with a distinct origin hostname for each environment. The TLS
   changes preserve the instance, data volume, and origin security group.
   Replace the example origin hostnames below with names covered by your
   certificates. Follow the maintenance-window sequence for existing stacks.

   ```sh
   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2 \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides Environment=dev OriginDomainName=origin-dev.example.com

   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2-prod \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides Environment=prod OriginDomainName=origin-prod.example.com
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

5. Set the following GitHub secrets from the role stack outputs:

   | Stack output | GitHub secret | Scope |
   | --- | --- | --- |
   | `BuildRoleArn` | `AWS_BUILD_ROLE_ARN` | Repository |
   | `DevRoleArn` | `AWS_DEV_ROLE_ARN` | `dev` environment |
   | `ProductionRoleArn` | `AWS_PRODUCTION_ROLE_ARN` | `production` environment |

   With GitHub CLI authenticated, these commands write the secrets:

   ```sh
   aws cloudformation describe-stacks \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --query "Stacks[0].Outputs[?OutputKey=='BuildRoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_BUILD_ROLE_ARN --repo Eleazarovich/chessdesk
   aws cloudformation describe-stacks \
     --stack-name chessdesk-github-actions --region af-south-1 \
     --query "Stacks[0].Outputs[?OutputKey=='DevRoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_DEV_ROLE_ARN --env dev --repo Eleazarovich/chessdesk
   aws cloudformation describe-stacks \
     --stack-name chessdesk-github-actions --region af-south-1 \
     --query "Stacks[0].Outputs[?OutputKey=='ProductionRoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_PRODUCTION_ROLE_ARN --env production --repo Eleazarovich/chessdesk
   ```

   The original role ARN remains the build role. Its legacy `RoleArn` output
   is retained for compatibility, but workflows never fall back to the old
   `AWS_ROLE_ARN` secret. Remove that obsolete GitHub secret after migration.
   Restrict both environments to `main`, disable administrator bypass, and
   require review for production. Changing workflow YAML alone cannot apply
   those GitHub environment protection settings.

Pull requests run the backend, frontend, Compose integration, and Playwright
E2E checks without AWS credentials. A push to `main` builds and pushes one
timestamped image, then deploys it to dev only after all checks pass. Production
promotion is a separate manual workflow and is allowed only from `main`; it
promotes the image currently running in dev when the workflow runs, regardless
of the commit used to start the workflow. After setting up or updating these
resources, run CI/CD from `main` (push or `workflow_dispatch`) to deploy a new
timestamped image to dev before using the promotion workflow.
