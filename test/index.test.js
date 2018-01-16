/* eslint-env node, mocha */
const chai = require('chai');
const sinon = require('sinon');
// const path = require('path');
const { getInstalledPathSync } = require('get-installed-path');
const ProviderGroupsPlugin = require('../index');

const expect = chai.expect;

chai.use(require('sinon-chai'));

const serverlessPath = getInstalledPathSync('serverless', { local: true });
const Serverless = require(`${serverlessPath}/lib/Serverless`); // eslint-disable-line

describe('Provider Groups', () => {
  let serverless;
  let options;
  let sandbox;
  let plugin;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    options = {
      stage: 'myStage',
      region: 'us-east-1',
    };
    serverless = new Serverless(options);
    serverless.cli = new serverless.classes.CLI(serverless);
    serverless.service.service = 'myService';
    serverless.config.servicePath = '';
    serverless.service.package = {};
    serverless.service.functions = {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('returns ProviderGroupsPlugin object with hook `before:package:initialize` and `before:offline:start:init`', () => {
      plugin = new ProviderGroupsPlugin(serverless);
      expect(plugin.hooks).to.have.all.keys('before:package:initialize', 'before:offline:start:init');
    });

    it('calls the same function for each hook', () => {
      plugin = new ProviderGroupsPlugin(serverless);
      const hookA = plugin.hooks['before:package:initialize'];
      const hookB = plugin.hooks['before:offline:start:init'];
      expect(hookA).to.equal(hookB);
    });
  });

  describe('hook', () => {
    it('returns synchronously', () => {
      plugin = new ProviderGroupsPlugin(serverless);
      expect(plugin.hooks['before:package:initialize']()).to.equal(undefined);
    });

    describe('warnings', () => {
      it('logs warning if providerGroup is not set in serverless.custom ', () => {
        const stub = sandbox.stub(serverless.cli, 'log');
        serverless.service.functions = {
          test: {
            providerGroups: [
              'auth0',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        expect(stub.calledWith('No provider groups found!')).to.equal(true);
      });

      it('logs warning if providerGroups is not an array ', () => {
        const stub = sandbox.stub(serverless.cli, 'log');
        serverless.service.custom.providerGroups = {};
        serverless.service.functions = {
          test: {
            providerGroups: {},
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        expect(stub.calledWith('test: providerGroups must be an array.')).to.equal(true);
      });


      it('logs warning if providerGroup name is not found in settings', () => {
        const stub = sandbox.stub(serverless.cli, 'log');
        serverless.service.custom.providerGroups = {};
        serverless.service.functions = {
          test: {
            providerGroups: [
              'auth0',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        expect(stub.calledWith('Could not find group', 'auth0')).to.equal(true);
      });
    });

    describe('object type variables', () => {
      ['vpc', 'environment'].forEach((variable) => {
        it(`inserts ${variable} variables from provider groups`, () => {
          serverless.service.custom.providerGroups = {
            foo: {
              [variable]: { a: true },
            },
            bar: {
              [variable]: { b: '123' },
            },
          };
          serverless.service.functions = {
            test: {
              providerGroups: [
                'foo',
                'bar',
              ],
            },
          };
          plugin = new ProviderGroupsPlugin(serverless);
          plugin.hooks['before:package:initialize']();
          const expected = {
            a: true,
            b: '123',
          };
          expect(serverless.service.functions.test[variable]).to.deep.equal(expected);
        });

        it(`inserts ${variable} variables from provider groups (merges with existing)`, () => {
          serverless.service.custom.providerGroups = {
            foo: {
              [variable]: { a: true },
            },
            bar: {
              [variable]: { b: '123' },
            },
          };
          serverless.service.functions = {
            test: {
              providerGroups: [
                'foo',
                'bar',
              ],
              [variable]: { c: 'woo' },
            },
          };
          plugin = new ProviderGroupsPlugin(serverless);
          plugin.hooks['before:package:initialize']();
          const expected = {
            a: true,
            b: '123',
            c: 'woo',
          };
          expect(serverless.service.functions.test[variable]).to.deep.equal(expected);
        });

        it(`inserts ${variable} variables from provider groups (overrides in order of declaration)`, () => {
          serverless.service.custom.providerGroups = {
            foo: {
              [variable]: { a: true },
            },
            bar: {
              [variable]: { a: false },
            },
          };
          serverless.service.functions = {
            test: {
              providerGroups: [
                'foo',
                'bar',
              ],
            },
          };
          plugin = new ProviderGroupsPlugin(serverless);
          plugin.hooks['before:package:initialize']();
          const expected = {
            a: false,
          };
          expect(serverless.service.functions.test[variable]).to.deep.equal(expected);
        });

        it('functions level variables take precedent over provider groups', () => {
          serverless.service.custom.providerGroups = {
            foo: {
              [variable]: { a: true },
            },
          };
          serverless.service.functions = {
            test: {
              providerGroups: [
                'foo',
              ],
              [variable]: {
                a: 'important',
              },
            },
          };
          plugin = new ProviderGroupsPlugin(serverless);
          plugin.hooks['before:package:initialize']();
          const expected = {
            a: 'important',
          };
          expect(serverless.service.functions.test[variable]).to.deep.equal(expected);
        });
      });
    });

    describe('iamRoleStatements', () => {

      const allowNetwork = {
        Effect: 'Allow',
        Action: [
          'ec2:CreateNetworkInterface',
          'ec2:DeleteNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DetachNetworkInterface',
        ],
        Resource: ['*'],
      };

      const allowPartialDynamodb = {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
          'dynamodb:GetItem',
        ],
        Resource: 'arn:aws:dynamodb:us-east-1:*:*',
      };

      const allowDynamodb = {
        Effect: 'Allow',
        Action: [
          'dynamodb:DescribeTable',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        Resource: 'arn:aws:dynamodb:us-east-1:*:*',
      };

      it('sets iamRoleStatements in provider from providerGroups set in services functions', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowNetwork],
          },
        };
        serverless.service.functions = {
          test: {
            providerGroups: [
              'foo',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowNetwork];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });

      it('does not duplicate if role is already present', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowNetwork],
          },
          bar: {
            iamRoleStatements: [allowNetwork],
          },
        };
        serverless.service.functions = {
          a: {
            providerGroups: [
              'foo',
            ],
          },
          b: {
            providerGroups: [
              'bar',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowNetwork];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });

      it('concats roles if declared in seporate functions', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowNetwork],
          },
          bar: {
            iamRoleStatements: [allowDynamodb],
          },
        };
        serverless.service.functions = {
          a: {
            providerGroups: [
              'foo',
            ],
          },
          b: {
            providerGroups: [
              'bar',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowNetwork, allowDynamodb];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });

      it('handles multiple roles, without duplicating', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowNetwork, allowDynamodb],
          },
          bar: {
            iamRoleStatements: [allowDynamodb],
          },
        };
        serverless.service.functions = {
          a: {
            providerGroups: [
              'foo',
            ],
          },
          b: {
            providerGroups: [
              'bar',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowNetwork, allowDynamodb];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });

      it('does not include a role if it is the subset of an already included role', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowDynamodb],
          },
          bar: {
            iamRoleStatements: [allowPartialDynamodb],
          },
        };
        serverless.service.functions = {
          a: {
            providerGroups: [
              'foo',
            ],
          },
          b: {
            providerGroups: [
              'bar',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowDynamodb];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });

      // TODO: make this work - replace narrow rule with broader rule
      xit('does not include a role if it is the subset of an already included role (reversed)', () => {
        serverless.service.custom.providerGroups = {
          foo: {
            iamRoleStatements: [allowPartialDynamodb],
          },
          bar: {
            iamRoleStatements: [allowDynamodb],
          },
        };
        serverless.service.functions = {
          a: {
            providerGroups: [
              'foo',
            ],
          },
          b: {
            providerGroups: [
              'bar',
            ],
          },
        };
        plugin = new ProviderGroupsPlugin(serverless);
        plugin.hooks['before:package:initialize']();
        const expected = [allowDynamodb];
        expect(serverless.service.provider.iamRoleStatements).to.deep.equal(expected);
      });
    });
  });
});
