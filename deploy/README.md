# AWS deployment

The GitHub Actions workflow deploys successful `main` builds to the EC2 instance
in the existing `chessdesk-ec2.yaml` stack. GitHub exchanges its OIDC token for
short-lived AWS credentials, then Systems Manager runs
[`deploy-ec2.sh`](deploy-ec2.sh) on the instance. No SSH key or inbound SSH rule
is used. The script builds the requested commit, keeps the SQLite EBS volume
mounted, waits for the new container's `/health` check, and restores the previous
container if the new one fails its local health check.

## One-time AWS setup

The workflow defaults to region `af-south-1` and app stack name `chessdesk-ec2`,
matching the defaults in `chessdesk-ec2.yaml`. Repository variables
`AWS_REGION` and `AWS_STACK_NAME` can override these if the app stack is in a
different region or has another name.

1. Ensure the AWS account has the GitHub OIDC identity provider
   `https://token.actions.githubusercontent.com`, with audience `sts.amazonaws.com`.
   If it is missing, create it once:

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. Create or update the app stack. This gives the workflow the EC2 instance and
   HTTPS URL outputs it reads before deploying. The template defaults to
   `af-south-1` resources:

   ```sh
   aws cloudformation deploy \
     --template-file deploy/chessdesk-ec2.yaml \
     --stack-name chessdesk-ec2 \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM
   ```

   If an app stack already exists under another name or in another region, keep
   that stack and set the `AWS_STACK_NAME` and `AWS_REGION` repository variables
   to its actual values instead of creating a second stack.

3. Deploy `github-actions-role.yaml` in the same region as the app stack. Supply
   the OIDC provider ARN and app stack name. The default subject allows only
   pushes from `Eleazarovich/chessdesk`'s `main` branch:

   ```sh
   aws cloudformation deploy \
     --template-file deploy/github-actions-role.yaml \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       GitHubOidcProviderArn=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com \
       ChessDeskStackName=chessdesk-ec2
   ```

   GitHub emits an immutable subject for this repository, and the template's
   default is `repo:Eleazarovich@96009758/chessdesk@1358729767:ref:refs/heads/main`.
   If the repository is transferred or GitHub shows a different exact subject,
   pass that value as `GitHubSubject`. The workflow does not use a GitHub
   environment, so the subject is branch based.

4. Set the GitHub repository secret `AWS_ROLE_ARN` to the role stack's `RoleArn`
   output. With GitHub CLI authenticated, this command writes it directly:

   ```sh
   aws cloudformation describe-stacks \
     --stack-name chessdesk-github-actions \
     --region af-south-1 \
     --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue | [0]" \
     --output text | gh secret set AWS_ROLE_ARN --repo Eleazarovich/chessdesk
   ```

   No `AWS_REGION` or `AWS_STACK_NAME` repository variables are needed when the
   defaults are used. The workflow stops with a setup link if `AWS_ROLE_ARN` is
   missing.

The deployment role can read outputs from that one stack, send the AWS-owned
`AWS-RunShellScript` document only to EC2 instances tagged `Project=ChessDesk`,
and read the command invocation result. Scope its GitHub OIDC trust subject to
the repository and deployment branch.

Pull requests run all three test jobs without AWS credentials. A push to `main`
deploys only after the parallel backend and frontend test jobs and the dependent
Compose integration and Playwright E2E job all pass. Manual workflow runs deploy
only when run against `main`.
