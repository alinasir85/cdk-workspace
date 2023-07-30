import * as destinations from 'aws-cdk-lib/aws-logs-destinations';
import {aws_opensearchservice as opensearch, Stack} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {AnyPrincipal, Effect, Policy, PolicyStatement, Role} from 'aws-cdk-lib/aws-iam';
import {LogGroup, SubscriptionFilter} from 'aws-cdk-lib/aws-logs';
import * as AWS from 'aws-sdk';
import {LogProcessorLambda} from "./LogProcessor";

export interface OpenSearchWithCloudWatchProps {
    domainName: string;
    username: string;
    password: string;
}

export class OpenSearchWithCloudWatch extends Construct {
    constructor(scope: Construct, id: string, props: OpenSearchWithCloudWatchProps) {
        super(scope, id);

        const openSearchDomain = this.createOpenSearchDomain(props);
        this.createAnonymousRoleAndPolicy(props);
        this.addAccessPolicyToOpenSearchDomain(openSearchDomain, props);

        const logProcessorLambda = new LogProcessorLambda(this, `LogProcessorLambdaToOpenSearch`, openSearchDomain.attrArn);
        this.addSubscriptionToLogGroups(logProcessorLambda);
    }

    private createOpenSearchDomain(props: OpenSearchWithCloudWatchProps) {
        return new opensearch.CfnDomain(this, 'OpenSearchDomain', {
            domainName: props.domainName,
            nodeToNodeEncryptionOptions: {enabled: true},
            encryptionAtRestOptions: {enabled: true},
            advancedSecurityOptions: {
                enabled: true,
                internalUserDatabaseEnabled: true,
                masterUserOptions: {
                    masterUserName: props.username,
                    masterUserPassword: props.password,
                },
            },
            domainEndpointOptions: {enforceHttps: true},
            ebsOptions: {ebsEnabled: true, volumeSize: 10, volumeType: 'gp2'},
            clusterConfig: {instanceType: "t3.small.search", instanceCount: 1}
        });
    }

    private createAnonymousRoleAndPolicy(props: OpenSearchWithCloudWatchProps) {
        const anonymousRole = new Role(this, 'AnonymousRole', {assumedBy: new AnyPrincipal()});
        anonymousRole.attachInlinePolicy(new Policy(this, 'AnonymousPolicy', {
            statements: [new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['es:ESHttp*'],
                resources: [`arn:aws:es:${Stack.of(this).region}:${Stack.of(this).account}:domain/${props.domainName}/*`]
            })]
        }));
    }

    private addAccessPolicyToOpenSearchDomain(openSearchDomain: opensearch.CfnDomain, props: OpenSearchWithCloudWatchProps) {
        openSearchDomain.accessPolicies = {
            Version: '2012-10-17',
            Statement: [{
                Effect: 'Allow',
                Principal: {AWS: '*'},
                Action: 'es:*',
                Resource: `arn:aws:es:${Stack.of(this).region}:${Stack.of(this).account}:domain/${props.domainName}/*`,
            }]
        };
    }

    private async addSubscriptionToLogGroups(logProcessorLambda: LogProcessorLambda) {
        const cloudWatchLogs = new AWS.CloudWatchLogs();

        try {
            const {logGroups} = await cloudWatchLogs.describeLogGroups({}).promise();

            if (logGroups) {
                for (const logGroup of logGroups) {
                    await this.handleLogGroupSubscription(logGroup, cloudWatchLogs, logProcessorLambda);
                }
            }
        } catch (error) {
            console.error('Error describing log groups:', error);
        }
    }

    private async handleLogGroupSubscription(logGroup: AWS.CloudWatchLogs.LogGroup, cloudWatchLogs: AWS.CloudWatchLogs, logProcessorLambda: LogProcessorLambda) {
        if (typeof logGroup.logGroupName !== "string") return;

        const logGroupName = logGroup.logGroupName;
        const describeFiltersParams = {logGroupName};

        try {
            const {subscriptionFilters} = await cloudWatchLogs.describeSubscriptionFilters(describeFiltersParams).promise();
            if (subscriptionFilters?.length === 0) {
                new SubscriptionFilter(this, `SubscriptionFilter-${logGroupName}`, {
                    filterPattern: {logPatternString: ''},
                    logGroup: LogGroup.fromLogGroupName(this, `LogGroup-${logGroupName}`, logGroupName),
                    destination: new destinations.LambdaDestination(logProcessorLambda)
                });
            } else {
                console.log(`Log group "${logGroupName}" already has subscriptions. Skipping.`);
            }
        } catch (error) {
            console.error(`Error describing subscription filters for log group "${logGroupName}":`, error);
        }
    }
}
