exports.handler = async function(event) {
    console.log("request IN RESPON HANDLER:", JSON.stringify(event, undefined, 2));
    return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: `Hello, CDK! You've hit ${event.counter}\n`
    };
};
