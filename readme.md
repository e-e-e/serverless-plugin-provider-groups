# serverless-plugin-provider-groups

[![Build Status](https://travis-ci.org/e-e-e/serverless-plugin-provider-groups.svg?branch=master)](https://travis-ci.org/e-e-e/serverless-plugin-provider-groups)
[![Coverage Status](https://coveralls.io/repos/github/e-e-e/serverless-plugin-provider-groups/badge.svg?branch=master)](https://coveralls.io/github/e-e-e/serverless-plugin-provider-groups?branch=master)

This plugin makes managing conceptually linked provider level variables (e.g.environment, vpc, iam roles ) easier for large serverless projects.

It allows you to group variables together under a single name, which can then be imported together into your individual functions. See usage below for a simple example.

## Installation

First install the plugin via NPM.

```
npm install serverless-plugin-provider-groups --save-dev
```

Then include the plugin within your serverless.yml config.

#### serverless.yml
```yml
plugins:
  - serverless-plugin-provider-groups
```

### Usage

To use, first add a `providerGroups` object to the `custom` options within your `serverless.yml` file. Then add any number of namespaces with any number of provider settings.

*Check [serverless documentation](https://serverless.com/framework/docs/providers/aws/guide/functions/) for configuration options.*

For example:

```yml
custom:
  providerGroups:
    auth0: # a simple group for auth0 related config
      environment:
        AUTH0_TOKEN: a_token
    redis: # a complex group for redis
      environment:
        REDIS_PORT: 6709
        REDIS_HOST: http://localhost
      vpc:
        securityGroupIds:
          - Ref: lambdaSecurityGroup
        subnetIds: your_redis_subnet_ids
      iamRoleStatements:
        - Effect: Allow
          Action:
            - ec2:CreateNetworkInterface # Allows VPC access for Lambda
            - ec2:DeleteNetworkInterface
            - ec2:DescribeNetworkInterfaces
            - ec2:DetachNetworkInterface
          Resource:
            - '*'
```


Once provider groups have been specified, you can then import them directly into your function calls.

For example:

```yml
functions:
  authorize:
    handler: authorize.handler
    providerGroups:
      - redis # adds all redis configs to this function
      - auth0 # adds all auth0 configs to this function
    events:
      - http:
          path: /authorize
          method: post
  getSomething:
    handler: handler.getSomething
    providerGroups:
      - redis # adds only the redis configs to this function
    events:
      - http:
          path: /get-something
          method: get
```
