const path = require('path')
const util = require('util')
//const types = require('./serverless.types.js')
const { Component, utils } = require('@serverless/core')
const exec = util.promisify(require('child_process').exec)
const aws = require('aws-sdk')
const { isEmpty, mergeDeepRight, pick } = require('ramda')
const {
  getDefaults,
  getAccountId,
  getPolicy
} = require('./utils')

const defaults = {
  name: 'daysmart-service',
  region: 'us-east-1',
  topic: 'arn:aws:sns:us-east-1:933922255734:daysmart-service-base-sns-topic-nj9ex4-b8au9pd',
  code: './code'
}

class AwsProcess extends Component {
  async default(inputs = {}) {
    const config = mergeDeepRight(getDefaults({ defaults }), inputs)
    const accountId = await getAccountId(aws)
    let outputs = {}

    const bucket = await this.load('@serverless/aws-s3')
    const role = await this.load('@serverless/aws-iam-role')
    const lambda = await this.load('@serverless/aws-lambda')
    const dynamodb = await this.load('@serverless/aws-dynamodb')
    const snsSubscription = await this.load('@serverless/aws-sns-subscription')
    
    this.context.status('Deploying AWS S3 Bucket')
    const bucketInputs = {
      name: config.name + '-process-' + this.context.resourceId(),
      region: config.region
    }
    const bucketOutputs = await bucket(bucketInputs)
    
    this.context.status('Deploying AWS IAM Role')
    const roleInputs = {
      name: config.name + '-process-lambda-role-' + this.context.resourceId(),
      region: config.region,
      service: 'lambda.amazonaws.com',
      policy: getPolicy(inputs.permissions)
    }
    const roleOutputs = await role(roleInputs)

    this.context.status('Deploying AWS Lambda & Uploading Code')
    const lambdaInputs = {
      name: config.name + '-process-lambda-' + this.context.resourceId(),
      description: inputs.description || 'A function for the ' + config.name + ' process component',
      memory: inputs.memory || 896,
      timeout: inputs.timeout || 10,
      runtime: 'nodejs8.10',
      code: config.code,
      role: roleOutputs,
      handler: 'shim.handler',
      shims: [path.join(__dirname, 'shim.js')],
      env: inputs.env || {},
      bucket: bucketOutputs.name,
      region: config.region
    }
    const lambdaOutputs = await lambda(lambdaInputs)
    
    this.context.status('Deploying AWS DynamoDB Table')
    const dynamodbInputs = {
      name: config.name + '-process-dynamodb-table-' + this.context.resourceId(),
      region: config.region
    }
    const dynamodbOutputs = await dynamodb(dynamodbInputs)
    
    this.context.status('Deploying AWS snsSubscription')
    const snsSubscriptionInputs = {
      name: config.name + '-process-sns-subscription-' + this.context.resourceId(),
      region: config.region,
      topic: config.topic,
      protocol: 'lambda',
      endpoint: lambdaOutputs.arn
      
    }
    const snsSubscriptionOutputs = await snsSubscription(snsSubscriptionInputs)

    outputs.bucket = bucketOutputs.name
    outputs.role = roleOutputs.arn
    outputs.lambda = lambdaOutputs.arn
    outputs.dynamodb = dynamodbOutputs.arn
    outputs.snsSubscription = snsSubscriptionOutputs.arn

    this.state.name = config.name
    this.state.bucket = bucketOutputs.name
    this.state.role = roleOutputs.arn
    this.state.lambda = lambdaOutputs.arn
    this.state.dynamodb = dynamodbOutputs.arn
    this.state.snsSubscription = snsSubscriptionOutputs.arn

    await this.save()

    return outputs
  }

  async remove(inputs = {}) {
    this.context.status('Removing')
    
    const role = await this.load('@serverless/aws-iam-role')
    const bucket = await this.load('@serverless/aws-s3')
    const lambda = await this.load('@serverless/aws-lambda')
    const dynamodb = await this.load('@serverless/aws-dynamodb')
    const snsSubscription = await this.load('@serverless/aws-sns-subscription')

    this.context.status('Removing AWS IAM Role')
    await role.remove()
    this.context.status('Removing AWS S3 Bucket')
    await bucket.remove()
    this.context.status('Removing AWS Lambda')
    await lambda.remove()
    this.context.status('Removing AWS Dynamodb Table')
    await dynamodb.remove()
    this.context.status('Removing AWS Sns Subscription')
    await snsSubscription.remove()

    this.state = {}
    await this.save()

    return {}
  }
}

module.exports = AwsProcess
