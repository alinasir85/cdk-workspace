import * as AWS from "aws-sdk";

exports.handler = async (event: any) => {
    console.log("******** In LogGroupSubscriptionHandlerLambda **********");
    const cloudWatchLogs = new AWS.CloudWatchLogs();
    const logGroupName = event?.detail?.requestParameters?.logGroupName || event.logGroupName;
    const logProcessorLambdaArn = process.env.LOG_PROCESSOR_LAMBDA_ARN;
    console.log("logProcessorLambdaArn: ",logProcessorLambdaArn);
    if (!logGroupName || !logProcessorLambdaArn) {
        console.error('Log group name or Log Processor Lambda ARN is not provided');
        return;
    }
    console.log("\nGoing to add subscription for logGroupName: ",logGroupName);
    const describeFiltersParams = { logGroupName };
    try {
        const { subscriptionFilters } = await cloudWatchLogs.describeSubscriptionFilters(describeFiltersParams).promise();
        console.log("\nsubscriptionFilters: ",subscriptionFilters);
        if (subscriptionFilters?.length === 0) {
            const putSubscriptionFilterParams = {
                filterName: `SubscriptionFilter-${logGroupName}`,
                logGroupName,
                filterPattern: '',
                destinationArn: logProcessorLambdaArn
            };
            await cloudWatchLogs.putSubscriptionFilter(putSubscriptionFilterParams).promise();
            console.log(`Subscription filter created for log group "${logGroupName}"`);
        } else {
            console.log(`Log group "${logGroupName}" already has subscriptions. Skipping.`);
        }
    } catch (error) {
        console.error(`Error describing subscription filters for log group "${logGroupName}":`, error);
    }
};
