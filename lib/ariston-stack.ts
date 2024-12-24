import * as cdk from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { createCNAME, createDistribution } from './network';
import { createPermissions } from './permissions';
import { createBuckets } from './storage';

/**
 * The `AristonStack` class extends the AWS CDK `Stack` class and is responsible for setting up the infrastructure for the Ariston service.
 *
 * This stack includes the following resources:
 *
 * - **Hosted Zone**: Retrieves the hosted zone using environment variables `HOSTED_ZONE_ID` and `HOSTED_ZONE_NAME`.
 * - **Certificate**: Retrieves the certificate using the environment variable `HOSTED_ZONE_CERTIFICATE`.
 * - **GitHub Actions Permissions**: Creates permissions for GitHub Actions autobuild.
 * - **S3 Bucket**: Creates an S3 bucket for frontend storage and grants read/write permissions to the GitHub Actions user.
 * - **ECR Repository**: Creates an ECR repository for the service and grants pull/push permissions to the GitHub Actions user.
 * - **Log Group**: Creates a CloudWatch log group for the service with a retention period of one week and a removal policy of destroy.
 * - **CloudFront Distribution**: Creates a CloudFront distribution for the frontend and grants invalidation permissions to the GitHub Actions user.
 * - **CNAME Record**: Creates a CNAME record for the distribution in the hosted zone.
 *
 * @param scope - The scope in which this stack is defined.
 * @param id - The scoped construct ID.
 * @param props - Stack properties.
 */
export class AristonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
    const repository = new Repository(this, `${this.stackName}EcrRepository`, {
      repositoryName: `${this.stackName.toLocaleLowerCase()}`,
    });
    repository.grantPullPush(githubActionsUser);

    /**
     * Log Group
     */
    new LogGroup(this, `${this.stackName}ServiceLogGroup`, {
      logGroupName: '/services/ariston',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
