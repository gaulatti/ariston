import { Stack, StackProps } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { createPermissions } from './permissions';

export class MatteottiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * Creates the permissions for the GitHub Actions autobuild.
     */
    const { githubActionsUser } = createPermissions(this);

    /**
     * Creates an ECR repository for the service.
     */
    const repository = new Repository(this, `${this.stackName}AristonEcrRepository`, {
      repositoryName: `${this.stackName.toLocaleLowerCase()}-ariston`,
    });
    repository.grantPullPush(githubActionsUser);
  }
}
