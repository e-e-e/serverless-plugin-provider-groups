function forEach(obj, fn) {
  Object.keys(obj).forEach(key => fn(obj[key], key, obj));
}

function mergeOrConcat(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.concat(b);
  }
  return Object.assign(a || {}, b || {});
}

function arrayIsSubset(set, subset) {
  if (set.length < subset.length) return false;
  return subset.every(value => set.includes(value));
}

function mergeIamRoles(iamRoleStatements, newRoleStatements) {
  newRoleStatements.forEach((newStatement) => {
    // check against existing role statements
    // is it included in any of them
    const coveredByAnotherStatement = iamRoleStatements.some((statement) => {
      const sameEffect = statement.Effect === newStatement.Effect;
      const sameActions = arrayIsSubset(statement.Action, newStatement.Action);
      if (typeof statement.Resource === 'string') statement.Resource = [statement.Resource]
      if (typeof newStatement.Resource === 'string') newStatement.Resource = [newStatement.Resource]
      const sameResources = arrayIsSubset(statement.Resource, newStatement.Resource);
      return (sameEffect && sameActions && sameResources);
    });
    if (coveredByAnotherStatement) {
      // no need to do anything
      return;
    }
    // add newStatement to provider
    // TODO: make this smarter - extend existing statements if there is overlap
    iamRoleStatements.push(newStatement);
  });
}

function injectGroups(serverless) {
  serverless.cli.log('Attempting to inject provider groups...');
  const functions = serverless.service.functions;
  const groups = serverless.service.custom.providerGroups;
  if (!groups) {
    serverless.cli.log('No provider groups found!');
    serverless.cli.log('Are you sure you have configured the provider groups plug-in correctly?');
    return;
  }
  if (!serverless.service.provider.iamRoleStatements) serverless.service.provider.iamRoleStatements = [];
  const iamRoleStatements = serverless.service.provider.iamRoleStatements;
  const iamGroupsToMerge = {};
  forEach(functions, (func, name) => {
    if (func.providerGroups) {
      if (!Array.isArray(func.providerGroups)) {
        serverless.cli.log(`${name}: providerGroups must be an array.`);
        return;
      }
      const allGroupedVars = func.providerGroups.reduce((envs, key) => {
        // for each provider group
        const providerVars = groups[key];
        if (!providerVars) {
          serverless.cli.log('Could not find group', key);
          serverless.cli.log('Are you sure you added it to custom.providerGroups?');
          return envs;
        }
        forEach(providerVars, (variable, varType) => {
          if (varType === 'iamRoleStatements') {
            if (providerVars.iamRoleStatements && !iamGroupsToMerge[key]) {
              iamGroupsToMerge[key] = providerVars.iamRoleStatements;
            }
            return;
          }
          if (!envs[varType]) {
            envs[varType] = variable;
            return;
          }
          envs[varType] = mergeOrConcat(envs[varType], variable);
        });
        return envs;
      }, {});
      // assign all grouped variables - does not override if already set.
      Object.keys(allGroupedVars).forEach((key) => {
        if (key === 'iamRoleStatements') {
          return;
        }
        func[key] = mergeOrConcat(allGroupedVars[key], func[key]);
      });
    }
  });
  // concat or add to provider ignoring duplicates
  forEach(iamGroupsToMerge, (roles) => {
    mergeIamRoles(iamRoleStatements, roles);
  });
}

class ProviderGroupsPlugin {
  constructor(serverless, options) {
    const boundInjectFn = injectGroups.bind(null, serverless, options);
    this.hooks = {
      'before:package:initialize': boundInjectFn,
      'before:offline:start:init': boundInjectFn,
    };
  }
}

module.exports = ProviderGroupsPlugin;
