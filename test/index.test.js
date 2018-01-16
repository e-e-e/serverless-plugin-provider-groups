/* eslint-env node, mocha */
const chai = require('chai');
const sinon = require('sinon');
const path = require('path');
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
  });
});
