# AWS deployment

ChessDesk uses the same CloudFormation template for separate environments. The
current low-cost setup keeps production running, pauses the extra app hosts,
and removes the monitoring stack:

- `chessdesk-ec2-prod` is the production environment and remains online.
- `chessdesk-pilot` and `chessdesk-ec2` (dev) are paused. Their stacks and app
  data volumes are retained for recovery; the disks continue to incur charges.
- `chessdesk-observability` and its Grafana secret, private DNS zone, and
  monitoring data volumes have been removed. Redeploying the stack starts
  monitoring with fresh data.

Production has its own EC2 instance, CloudFront distribution, security group,
and encrypted SQLite EBS volume. It has a separate database from dev. The app
stacks share the configured VPC and subnet.

Each app stack has its own CloudFront HTTPS URL and database. Deleting a dev or
pilot stack retains its app data volume, which remains billable until separately
deleted.

The default viewer URLs are <https://d1bqcmvdafa6rq.cloudfront.net> (dev) and
<https://d2mo1cbaii74n0.cloudfront.net> (production). A stack can use a custom
viewer hostname with an ACM certificate while retaining the CloudFront URL.
The paused pilot viewer URL is
<https://d31zxie2q9jxf5.cloudfront.net>; it will not work until the pilot host
is restarted and its CloudFront origin points to the host's current public DNS.

## Custom viewer domains

Set `ViewerDomainName` and `ViewerCertificateArn` together on a stack. The ACM
certificate must cover the viewer hostname and be in `us-east-1`. CloudFront
then serves HTTPS for that name, and the `SiteUrl` output reports the custom
URL. Leave both parameters empty to keep the CloudFront-provided URL.

Keep the browser-facing name separate from `OriginDomainName`. For example,
dev can use `dev.chessdesk.plynera.co.za` as its viewer name and
`origin-dev.chessdesk.plynera.co.za` as its origin name. Point the origin CNAME
to the EC2 public DNS name and install a trusted origin certificate covering
that origin name. Point the viewer CNAME to the CloudFront distribution domain
only after the alias and viewer certificate have been deployed. Using the same
hostname for both makes CloudFront resolve its origin back to itself.

For Xneelo DNS, ACM supplies a CNAME for certificate validation. Keep that
record in place to allow ACM to renew the certificate. Xneelo requires a final
period on CNAME destinations. Set the viewer CNAME destination to the stack's
`CloudFrontDomainName` output, with that final period. Keep the production
viewer record on its existing target until the CloudFront alias and TLS origin
are deployed and verified.

## Security upgrade and origin certificates

The security upgrade is a coordinated application, workflow, and IAM change.
Review it locally before updating AWS. Do not purchase a domain or certificate,
create billable resources, or start a chargeable deployment without the owner's
approval. This configuration reuses the existing EC2 instance, EBS volume,
security group, and CloudFront distribution; it adds no load balancer or secret
storage service.

CloudFront connects to the origin using HTTPS on port 8443 after the staged
cutover. Each environment needs an origin hostname you control, such as
`origin-dev.example.com`, with a publicly trusted certificate for that
hostname. The `cloudfront.net` viewer certificate cannot be installed on EC2,
and CloudFront does not accept a self-signed origin certificate. An ACME
certificate can be free when an appropriate domain is already available.

Custom viewer domains are optional. The existing domain can also provide the
origin hostname, but keep the origin and viewer DNS names separate. A
[Let's Encrypt certificate](https://letsencrypt.org/getting-started/) can
provide a free origin certificate; DNS validation requires adding a temporary
TXT record and certificate renewal remains an operator responsibility.

Before deploying the updated application:

1. Provision each origin hostname's DNS CNAME to its EC2 public DNS name
   (`OriginDnsTarget` after the template update; available from EC2 beforehand).
   A DNS A record pointing to the instance's public IPv4 address also works;
   use that option with DuckDNS and update it if the instance's IP changes.
   Keep this origin hostname separate from the viewer hostname. The viewer
   hostname's CNAME should point to CloudFront's distribution domain after
   `ViewerDomainName` and its ACM certificate have been deployed.
2. Obtain a certificate, preferably using DNS validation so no public HTTP or
   SSH ingress needs to be opened. Transfer its PEM full certificate chain and
   unencrypted private key through an approved secure operator channel to the
   existing host's encrypted EBS volume as
   `/data/chessdesk-tls/fullchain.pem` and `/data/chessdesk-tls/privkey.pem`.
   Keep the directory at mode 0700 and files at 0600, owned by UID/GID 10001.
   Keep keys out of git, shell command arguments, SSM command bodies, and logs.
   Ensure the host has the `openssl` command for certificate checks.
3. Apply the IAM template and configure the build and production role secrets
   below. The old shared role becomes build-only; code changes alone do not
   revoke its permissions in AWS.
4. After the viewer certificate is `ISSUED`, update the production stack with
   `OriginDomainName`, `ViewerDomainName`, and `ViewerCertificateArn`, keeping
   `EnableOriginHttps=false` and `LegacyHttpOriginEnabled=true`. This adds the
   alias and opens the TLS port from CloudFront while preserving the current
   HTTP origin path.
5. Push the application change to `main` and approve the production deployment
   in GitHub. The container runs both HTTP on port 8000 and TLS on 8443 during
   the migration. The deployment script verifies the certificate chain,
   hostname, key match, and at least 24 hours of validity before replacing the
   current container. The workflow checks health through the CloudFront
   distribution even before public DNS is changed.
6. Set `EnableOriginHttps=true` on the production stack. After CloudFront
   reports `Deployed`, verify the custom hostname through CloudFront, then
   change the Xneelo `chessdesk` CNAME to the stack's `CloudFrontDomainName`
   output. After the domain works, set `LegacyHttpOriginEnabled=false` to close
   the old HTTP origin port. Requests to the distribution's generated hostname
   permanently redirect to the configured viewer hostname, keeping the
   requested path and query parameters.
7. Check the public `/health` endpoint and sign in again. Legacy application
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

GitHub Actions runs the backend, frontend, and Compose checks, builds the
application image, pushes it to one shared ECR repository, and deploys it
directly to production from `main`. This avoids keeping a second EC2 host online
for testing. ECR rejects tag overwrites. Tags use the UTC
`YYYYMMDD-HHMMSS-shortsha` format, for example `20260818-163457-83242da`.
The production deploy uses Systems Manager, waits for the new container's
health check, and restores the previous container if the new one fails. The
workflow checks the production hostname through CloudFront before DNS changes.
No SSH key or inbound SSH rule is used. The GitHub `production` environment
requires approval before deployment.

The backend exports OpenTelemetry request and SQLAlchemy spans, HTTP request and
SQLAlchemy connection metrics only when an OTLP endpoint is configured in the
container. The deployment script disables exporters by default. To restore
telemetry, redeploy the observability stack, then set the GitHub repository
variable `CHESSDESK_OTEL_ENDPOINT` to `http://otel.chessdesk.internal:4317` and
deploy the app. Monitoring starts with fresh history. Every telemetry signal includes the
`chessdesk-backend` service name, the `dev` or `production` deployment
environment, and the full deployed Git commit SHA as `service.version`.

To restore a paused app host, start its EC2 instance in the AWS console or with
the AWS API. A stopped instance releases its automatically assigned public IPv4
address, so its public DNS name can change. Update the origin DNS record or
CloudFront origin to the new public DNS name before using its viewer URL. The
pilot distribution currently points directly to its old EC2 public DNS name.
The app hosts' attached EBS data remains in place.

## One-time AWS setup

The workflow defaults to region `af-south-1` and production stack
`chessdesk-ec2-prod`. Repository variables `AWS_REGION` and
`AWS_PROD_STACK_NAME` can override those values. The dev stack name is needed
only when restoring a separate dev deployment workflow.

1. Ensure the AWS account has the GitHub OIDC identity provider
   `https://token.actions.githubusercontent.com`, with audience `sts.amazonaws.com`.
   If it is missing, create it once:

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. Deploy `github-actions-role.yaml` in the same region. It creates the shared
   ECR repository and build, dev, and production roles. The lean workflow uses
   only the build and production roles; the dev role remains available if a
   separate dev deployment workflow is restored. The production role can run
   commands only on ChessDesk app instances.
   Restrict the GitHub `production` environment to the `main` branch and disable
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
     --parameter-overrides Environment=dev OriginDomainName=origin-dev.example.com \
       ViewerDomainName=dev.example.com \
       ViewerCertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID

   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2-prod \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides Environment=prod OriginDomainName=origin-prod.example.com \
       ViewerDomainName=example.com \
       ViewerCertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID \
       EnableOriginHttps=false LegacyHttpOriginEnabled=true
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
     --query "Stacks[0].Outputs[?OutputKey=='ProductionRoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_PRODUCTION_ROLE_ARN --env production --repo Eleazarovich/chessdesk
   ```

   The original role ARN remains the build role. Its legacy `RoleArn` output
   is retained for compatibility, but workflows never fall back to the old
   `AWS_ROLE_ARN` secret. Remove that obsolete GitHub secret after migration.
   Restrict the production environment to `main`, disable administrator
   bypass, and require review if manual approval is desired. Changing workflow YAML alone cannot apply
   those GitHub environment protection settings.

Pull requests run the backend, frontend, Compose integration, and Playwright
E2E checks without AWS credentials. A push to `main` builds and pushes one
timestamped image, then deploys it to production only after all checks pass.
The production deployment uses the production environment role and has a
rollback health check. After setting up these resources, push to `main` or run
CI/CD with `workflow_dispatch` from `main` to deploy.

## Password reset email

ChessDesk sends password reset messages through Resend. The email service has
a free tier suitable for this app. Before enabling delivery:

1. In Resend, add `mail.chessdesk.plynera.co.za` as the sending domain. Publish
   the DNS records Resend provides for sending, then wait until Resend marks
   the domain verified. Keep these records on the `mail` subdomain; the app is hosted at
   `chessdesk.plynera.co.za`. Do not replace existing DNS records with generic
   SPF or MX values; use the exact records Resend displays.
2. Create a Resend API key. Do not put the key in GitHub Actions variables,
   source control, shell arguments, SSM Run Command, or logs.
3. Add the key on the production EC2 host through an approved interactive
   secret-entry session that does not record terminal input. Store it at
   `/data/chessdesk-resend-api-key`, owned by UID/GID 10001 with mode `0400`.
   This file is on the existing encrypted EBS data volume. The deployment
   script mounts it read-only at `/run/secrets/resend_api_key`.
4. The production workflow defaults `CHESSDESK_EMAIL_FROM` to
   `ChessDesk <no-reply@mail.chessdesk.plynera.co.za>`. Set the non-secret GitHub
   `production` environment variable `CHESSDESK_EMAIL_FROM` only if you want to
   override that sender. The workflow passes the app's CloudFormation `SiteUrl`
   as `CHESSDESK_PUBLIC_URL`, so reset links use the deployed site hostname.
5. Deploy the app after the key file is in place and the sending domain is
   verified. The reset email flow remains disabled if any required setting is
   missing.

The API key is not committed to this repository or sent in the deployment
command. Rotate it by replacing the protected host file and deploying again.
