# AWS deployment

The GitHub Actions workflow deploys successful `main` builds to the EC2 instance
in the existing `chessdesk-ec2.yaml` stack. GitHub exchanges its OIDC token for
short-lived AWS credentials, then Systems Manager runs
[`deploy-ec2.sh`](deploy-ec2.sh) on the instance. No SSH key or inbound SSH rule
is used. The script builds the requested commit, keeps the SQLite EBS volume
mounted, waits for the new container's `/health` check, and restores the previous
container if the new one fails its local health check.

## One-time AWS setup

1. Ensure the AWS account has the GitHub OIDC identity provider
   `https://token.actions.githubusercontent.com`, with audience `sts.amazonaws.com`.
   If it is missing, create it once:

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. Deploy `github-actions-role.yaml` in the same region as the app stack. Supply
   the OIDC provider ARN and the app stack name. The default subject allows only
   pushes from `Eleazarovich/chessdesk`'s `main` branch:

   ```sh
   aws cloudformation deploy \
     --template-file deploy/github-actions-role.yaml \
     --stack-name chessdesk-github-actions \
     --region YOUR_AWS_REGION \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       GitHubOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com \
       ChessDeskStackName=YOUR_CHESSDESK_STACK_NAME
   ```

   If GitHub shows an immutable subject claim for this repository, pass that
   exact value as `GitHubSubject`. The workflow does not use a GitHub environment,
   so the subject is branch based.

3. Update the existing app stack with `deploy/chessdesk-ec2.yaml` once so its
   instance receives the SSM managed instance profile. Its instance role grants
   Systems Manager access only; the app keeps its current network and storage
   configuration.

4. In the GitHub repository, set:

   - Secret `AWS_ROLE_ARN`: the `RoleArn` output from the role stack.
   - Variable `AWS_REGION`: the AWS region containing the app stack.
   - Variable `AWS_STACK_NAME`: the existing app CloudFormation stack name.

The deployment role can read outputs from that one stack, send the AWS-owned
`AWS-RunShellScript` document only to EC2 instances tagged `Project=ChessDesk`,
and read the command invocation result. Scope its GitHub OIDC trust subject to
the repository and deployment branch.

Pull requests run all three test jobs without AWS credentials. A push to `main`
deploys only after the parallel backend and frontend test jobs and the dependent
Compose integration and Playwright E2E job all pass. Manual workflow runs deploy
only when run against `main`.
