import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { createCNAME, createDistribution } from './network';
import { createPermissions } from './permissions';
import { createBuckets } from './storage';

export class MatteottiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     *  Hosted Zone
     */
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, `${this.stackName}HostedZone`, {
      hostedZoneId: process.env.HOSTED_ZONE_ID!,
      zoneName: process.env.HOSTED_ZONE_NAME!,
    });

    const certificate = Certificate.fromCertificateArn(this, `${this.stackName}Certificate'`, process.env.HOSTED_ZONE_CERTIFICATE!);
    /**
     * Creates the permissions for the GitHub Actions autobuild.
     */
    const { githubActionsUser } = createPermissions(this);

    /**
     * Storage (S3)
     */
    const { frontendBucket } = createBuckets(this);
    frontendBucket.grantReadWrite(githubActionsUser);

    /**
     * Creates an ECR repository for the service.
     */
    const repository = new Repository(this, `${this.stackName}AristonEcrRepository`, {
      repositoryName: `${this.stackName.toLocaleLowerCase()}-ariston`,
    });
    repository.grantPullPush(githubActionsUser);

    /**
     * Log Group
     */
    new LogGroup(this, `${this.stackName}AristonLogGroup`, {
      logGroupName: '/services/ariston',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Creates the distribution for the frontend.
     */
    const { distribution } = createDistribution(this, frontendBucket, certificate);
    distribution.grantCreateInvalidation(githubActionsUser);

    /**
     * Creates the CNAME for the distribution.
     */
    createCNAME(this, hostedZone, distribution);
  }
}
