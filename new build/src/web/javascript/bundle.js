(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;
  hb.escapeExpression = Utils.escapeExpression;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

/*jshint -W040 */
/* istanbul ignore next */
var root = typeof global !== 'undefined' ? global : window,
    $Handlebars = root.Handlebars;
/* istanbul ignore next */
Handlebars.noConflict = function() {
  if (root.Handlebars === Handlebars) {
    root.Handlebars = $Handlebars;
  }
};

Handlebars['default'] = Handlebars;

exports["default"] = Handlebars;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./handlebars/base":2,"./handlebars/exception":3,"./handlebars/runtime":4,"./handlebars/safe-string":5,"./handlebars/utils":6}],2:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "3.0.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 6;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn) {
    if (toString.call(name) === objectType) {
      if (fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function(name) {
    delete this.helpers[name];
  },

  registerPartial: function(name, partial) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      if (typeof partial === 'undefined') {
        throw new Exception('Attempting to register a partial as undefined');
      }
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function(name) {
    delete this.partials[name];
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(/* [args, ]options */) {
    if(arguments.length === 1) {
      // A missing field in a {{foo}} constuct.
      return undefined;
    } else {
      // Someone is actually trying to call something, blow up.
      throw new Exception("Missing helper: '" + arguments[arguments.length-1].name + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        if (options.ids) {
          options.ids = [options.name];
        }

        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.name);
        options = {data: data};
      }

      return fn(context, options);
    }
  });

  instance.registerHelper('each', function(context, options) {
    if (!options) {
      throw new Exception('Must pass iterator to #each');
    }

    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    var contextPath;
    if (options.data && options.ids) {
      contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
    }

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    function execIteration(key, i, last) {
      if (data) {
        data.key = key;
        data.index = i;
        data.first = i === 0;
        data.last  = !!last;

        if (contextPath) {
          data.contextPath = contextPath + key;
        }
      }

      ret = ret + fn(context[key], {
        data: data,
        blockParams: Utils.blockParams([context[key], key], [contextPath + key, null])
      });
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          execIteration(i, i, i === context.length-1);
        }
      } else {
        var priorKey;

        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            // We're running the iterations one step out of sync so we can detect
            // the last iteration without have to scan the object twice and create
            // an itermediate keys array. 
            if (priorKey) {
              execIteration(priorKey, i-1);
            }
            priorKey = key;
            i++;
          }
        }
        if (priorKey) {
          execIteration(priorKey, i-1, true);
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    var fn = options.fn;

    if (!Utils.isEmpty(context)) {
      if (options.data && options.ids) {
        var data = createFrame(options.data);
        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]);
        options = {data:data};
      }

      return fn(context, options);
    } else {
      return options.inverse(this);
    }
  });

  instance.registerHelper('log', function(message, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, message);
  });

  instance.registerHelper('lookup', function(obj, field) {
    return obj && obj[field];
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 1,

  // Can be overridden in the host environment
  log: function(level, message) {
    if (typeof console !== 'undefined' && logger.level <= level) {
      var method = logger.methodMap[level];
      (console[method] || console.log).call(console, message);
    }
  }
};
exports.logger = logger;
var log = logger.log;
exports.log = log;
var createFrame = function(object) {
  var frame = Utils.extend({}, object);
  frame._parent = object;
  return frame;
};
exports.createFrame = createFrame;
},{"./exception":3,"./utils":6}],3:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var loc = node && node.loc,
      line,
      column;
  if (loc) {
    line = loc.start.line;
    column = loc.start.column;

    message += ' - ' + line + ':' + column;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (loc) {
    this.lineNumber = line;
    this.column = column;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],4:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;
var createFrame = require("./base").createFrame;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  /* istanbul ignore next */
  if (!env) {
    throw new Exception("No environment passed to template");
  }
  if (!templateSpec || !templateSpec.main) {
    throw new Exception('Unknown template object: ' + typeof templateSpec);
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  env.VM.checkRevision(templateSpec.compiler);

  var invokePartialWrapper = function(partial, context, options) {
    if (options.hash) {
      context = Utils.extend({}, context, options.hash);
    }

    partial = env.VM.resolvePartial.call(this, partial, context, options);
    var result = env.VM.invokePartial.call(this, partial, context, options);

    if (result == null && env.compile) {
      options.partials[options.name] = env.compile(partial, templateSpec.compilerOptions, env);
      result = options.partials[options.name](context, options);
    }
    if (result != null) {
      if (options.indent) {
        var lines = result.split('\n');
        for (var i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = options.indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    } else {
      throw new Exception("The partial " + options.name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    strict: function(obj, name) {
      if (!(name in obj)) {
        throw new Exception('"' + name + '" not defined in ' + obj);
      }
      return obj[name];
    },
    lookup: function(depths, name) {
      var len = depths.length;
      for (var i = 0; i < len; i++) {
        if (depths[i] && depths[i][name] != null) {
          return depths[i][name];
        }
      }
    },
    lambda: function(current, context) {
      return typeof current === 'function' ? current.call(context) : current;
    },

    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,

    fn: function(i) {
      return templateSpec[i];
    },

    programs: [],
    program: function(i, data, declaredBlockParams, blockParams, depths) {
      var programWrapper = this.programs[i],
          fn = this.fn(i);
      if (data || depths || blockParams || declaredBlockParams) {
        programWrapper = program(this, i, fn, data, declaredBlockParams, blockParams, depths);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(this, i, fn);
      }
      return programWrapper;
    },

    data: function(data, depth) {
      while (data && depth--) {
        data = data._parent;
      }
      return data;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = Utils.extend({}, common, param);
      }

      return ret;
    },

    noop: env.VM.noop,
    compilerInfo: templateSpec.compiler
  };

  var ret = function(context, options) {
    options = options || {};
    var data = options.data;

    ret._setup(options);
    if (!options.partial && templateSpec.useData) {
      data = initData(context, data);
    }
    var depths,
        blockParams = templateSpec.useBlockParams ? [] : undefined;
    if (templateSpec.useDepths) {
      depths = options.depths ? [context].concat(options.depths) : [context];
    }

    return templateSpec.main.call(container, context, container.helpers, container.partials, data, blockParams, depths);
  };
  ret.isTop = true;

  ret._setup = function(options) {
    if (!options.partial) {
      container.helpers = container.merge(options.helpers, env.helpers);

      if (templateSpec.usePartial) {
        container.partials = container.merge(options.partials, env.partials);
      }
    } else {
      container.helpers = options.helpers;
      container.partials = options.partials;
    }
  };

  ret._child = function(i, data, blockParams, depths) {
    if (templateSpec.useBlockParams && !blockParams) {
      throw new Exception('must pass block params');
    }
    if (templateSpec.useDepths && !depths) {
      throw new Exception('must pass parent depths');
    }

    return program(container, i, templateSpec[i], data, 0, blockParams, depths);
  };
  return ret;
}

exports.template = template;function program(container, i, fn, data, declaredBlockParams, blockParams, depths) {
  var prog = function(context, options) {
    options = options || {};

    return fn.call(container,
        context,
        container.helpers, container.partials,
        options.data || data,
        blockParams && [options.blockParams].concat(blockParams),
        depths && [context].concat(depths));
  };
  prog.program = i;
  prog.depth = depths ? depths.length : 0;
  prog.blockParams = declaredBlockParams || 0;
  return prog;
}

exports.program = program;function resolvePartial(partial, context, options) {
  if (!partial) {
    partial = options.partials[options.name];
  } else if (!partial.call && !options.name) {
    // This is a dynamic partial that returned a string
    options.name = partial;
    partial = options.partials[partial];
  }
  return partial;
}

exports.resolvePartial = resolvePartial;function invokePartial(partial, context, options) {
  options.partial = true;

  if(partial === undefined) {
    throw new Exception("The partial " + options.name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;function initData(context, data) {
  if (!data || !('root' in data)) {
    data = data ? createFrame(data) : {};
    data.root = context;
  }
  return data;
}
},{"./base":2,"./exception":3,"./utils":6}],5:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = SafeString.prototype.toHTML = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],6:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
/* istanbul ignore next */
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
/* istanbul ignore next */
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;
// Older IE versions do not directly support indexOf so we must implement our own, sadly.
function indexOf(array, value) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (array[i] === value) {
      return i;
    }
  }
  return -1;
}

exports.indexOf = indexOf;
function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string && string.toHTML) {
    return string.toHTML();
  } else if (string == null) {
    return "";
  } else if (!string) {
    return string + '';
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;function blockParams(params, ids) {
  params.path = ids;
  return params;
}

exports.blockParams = blockParams;function appendContextPath(contextPath, id) {
  return (contextPath ? contextPath + '.' : '') + id;
}

exports.appendContextPath = appendContextPath;
},{}],7:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime').default;

},{"./dist/cjs/handlebars.runtime":1}],8:[function(require,module,exports){
module.exports = require("handlebars/runtime")["default"];

},{"handlebars/runtime":7}],9:[function(require,module,exports){
(function (global){
//templates to be precompiled and sent to browser
var $ = (typeof window !== "undefined" ? window.$ : typeof global !== "undefined" ? global.$ : null);

module.exports = {
	notfound:(function(){
	var t = require("../templates/404notfound.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	construction:(function(){
	var t = require("../templates/construction.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	index:(function(){
		var t = require("../templates/index.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	navbar:(function(){
		var t = require("../templates/navbar.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	login:(function(){
		var t = require("../templates/login.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	signup:(function(){
		var t = require("../templates/signup.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	recover:(function(){
		var t = require("../templates/recover.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	setpassword:(function(){
		var t = require("../templates/set-password.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	statuspage:{
		index:(function(){
			var t = require("../templates/status-page.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		row:(function(){
			var t = require("../templates/status-page-add-status-row.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})()
	},
	uploadpage:{
		index:(function(){
			var t = require("../templates/upload.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		vcf:(function(){
			var t = require("../templates/upload-add-vcf.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		progress:(function(){
			var t = require("../templates/upload-add-progress-bar.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})()
	},
	project:{
		index:(function(){
			var t = require("../templates/project.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		new:(function(){
			var t = require("../templates/project-add-project.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		info:(function(){
			var t = require("../templates/project-info-page.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		user:(function(){
			var t = require("../templates/project-auth-user.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
	},
	patient:(function(){
	var t = require("../templates/patients-table.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	pgx:(function(){
	var t = require("../templates/pgx-page.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	config:(function(){
		var t = require('../templates/server-config.hbs');
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			});
		}
	})()
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../templates/404notfound.hbs":11,"../templates/construction.hbs":12,"../templates/index.hbs":13,"../templates/login.hbs":14,"../templates/navbar.hbs":15,"../templates/patients-table.hbs":16,"../templates/pgx-page.hbs":17,"../templates/project-add-project.hbs":18,"../templates/project-auth-user.hbs":19,"../templates/project-info-page.hbs":20,"../templates/project.hbs":21,"../templates/recover.hbs":22,"../templates/server-config.hbs":23,"../templates/set-password.hbs":24,"../templates/signup.hbs":25,"../templates/status-page-add-status-row.hbs":26,"../templates/status-page.hbs":27,"../templates/upload-add-progress-bar.hbs":28,"../templates/upload-add-vcf.hbs":29,"../templates/upload.hbs":30}],10:[function(require,module,exports){
templates = require('./templates')


},{"./templates":9}],11:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    return \"<div class=\\\"row\\\" style=\\\"padding-top: 200px;\\\">\\r\\n  <div class=\\\"large-6 large-centered columns\\\">\\r\\n    <div class=\\\"row\\\">\\r\\n      <div class=\\\"large-4 columns\\\">\\r\\n        <i class=\\\"fa fa-gears\\\" style=\\\"font-size: 6em;\\\"></i>\\r\\n      </div>\\r\\n      <div class=\\\"large-8 columns\\\">\\r\\n        <h2><em>404 Not Found!</em></h2>\\r\\n        <h4 class=\\\"subheader\\\">There's nothing here!</h4>\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],12:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    return \"<div class=\\\"row\\\" style=\\\"padding-top: 200px;\\\">\\r\\n  <div class=\\\"large-6 large-centered columns\\\">\\r\\n    <div class=\\\"row\\\">\\r\\n      <div class=\\\"large-4 columns\\\">\\r\\n        <i class=\\\"fa fa-wrench\\\" style=\\\"font-size: 6em;\\\"></i>\\r\\n      </div>\\r\\n      <div class=\\\"large-8 columns\\\">\\r\\n        <h2><em>In development</em></h2>\\r\\n        <h4 class=\\\"subheader\\\">Come back soon!</h4>\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],13:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"  <div class=\\\"row\\\" style=\\\"padding-top: 30px;\\\">  \\r\\n    <div class=\\\"large-12 columns\\\">\\r\\n      <h1>\"\n    + alias3(((helper = (helper = helpers.title || (depth0 != null ? depth0.title : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"title\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h2>\\r\\n      <h4 class=\\\"subheader\\\">Next-generation genome annotation.</h4>\\r\\n      <h5>Welcome to the private beta testing phase of <em>\"\n    + alias3(((helper = (helper = helpers.title || (depth0 != null ? depth0.title : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"title\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</em>. This is open-source software written by the Bader and Brudno labs at the University of Toronto for the clinical community. Our goal is to create apps to bring genomic data to the clinic. Let us know if you'd like any new features for your clinical workflows.</h5>\\r\\n    </div>\\r\\n  </div>\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"large-12 columns\\\">\\r\\n      <hr>\\r\\n      <img src=\\\"img/Emiliano Ponzi - Scientific divulgation - La Repubblica.jpg\\\">\\r\\n      <hr>\\r\\n    </div>\\r\\n  </div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],14:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    return \"                  <span>First time Here? <a href=\\\"/signup\\\">Signup</a></span>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    return \"                  <span>Forgot Password? <a href=\\\"/recover\\\">Recover</a></span>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    return \"                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-2 columns\\\">\\r\\n                    <h4>Or</h4>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-12 columns small-centered text-center\\\">\\r\\n                    <a href=\\\"/auth/google\\\" ><img src=\\\"img/signin1.png\\\" class=\\\"small-12 small-centered \\\"style=\\\"width:60%;height:60%\\\"></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div style=\\\"min-height:100%;\\\">\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"small-12 medium-8 large-6 large-centered medium-centered columns\\\">\\r\\n      <form data-abide=\\\"ajax\\\" id=\\\"frangipani-request-login\\\" style=\\\"margin-top:20%\\\">\\r\\n        <fieldset>\\r\\n          <h3 style=\\\"margin-bottom:60px;margin-top:10px;\\\"><i class=\\\"fa fa-chevron-right\\\"></i>&nbspLog In</h3>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n              <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                <!-- Alert message goes here -->\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-11 columns\\\">\\r\\n                    <p id=\\\"error-display-message\\\"></p>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-1 columns\\\">\\r\\n                    <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" >\\r\\n            <div class=\\\"small-12 large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-3 large-3 columns\\\">\\r\\n                  <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-left radius\\\" title=\\\"Please enter a valid email address\\\"><span class=\\\"prefix\\\"><i class=\\\"fa fa-envelope-o fa-lg\\\"></i></span></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-9 large-9 columns\\\">\\r\\n                  <input type=\\\"email\\\" id='username' name='username' required>\\r\\n                  <small class=\\\"error\\\">Your username must be a valid email</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-3 large-3 columns\\\">\\r\\n                  <span class=\\\"prefix\\\"><i class=\\\"fa fa-key fa-lg\\\"></i></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-9 large-9 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='password' name='password' required pattern=\\\"lower\\\">\\r\\n                  <small class=\\\"error\\\">Passwords must be between 6 and 40 characters long</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" style=\\\"margin-top:20px;\\\">\\r\\n            <div class=\\\"small-4 large-3 columns\\\">\\r\\n              <button type=\\\"submit\\\" id=\\\"submit-login\\\" class=\\\"button radius alert\\\">Login</button>\\r\\n            </div>\\r\\n            <div class=\\\"small-8 large-9 columns\\\">\\r\\n              <div class=\\\"small-12 large-12 columns\\\" id=\\\"extra-field-1\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.signup : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"              </div>\\r\\n              <div class=\\\"small-12 large-12 columns\\\" id=\\\"extra-field-2\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.recover : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 large-12 columns\\\" id=\\\"extra-field-3\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.oauth : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"            </div>\\r\\n          </div>\\r\\n        </fieldset>\\r\\n      </form>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n\\r\\n\\r\\n\\r\\n\\r\\n\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],15:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"  <section class=\\\"top-bar-section\\\">\\r\\n    <!-- Right Nav Section -->\\r\\n    <ul class=\\\"right show-for-medium-up\\\">\\r\\n      <li class=\\\"has-dropdown\\\">\\r\\n        <a href=\\\"#\\\" class=\\\"button radius alert\\\" id=\\\"frangipani-plus-icon\\\"><i class=\\\"fi-plus size-16\\\"></i></a>\\r\\n        <ul class=\\\"dropdown\\\">\\r\\n          <li><a href=\\\"/upload\\\" id=\\\"frangipani-add-new-patient\\\"><i class=\\\"fi-torso size-24\\\"></i>&nbsp&nbsp&nbsp Add Patient</a></li>\\r\\n          <li><a href=\\\"/projects\\\" id=\\\"frangipani-add-new-project\\\"><i class=\\\"fi-page-multiple size-24\\\"></i>&nbsp&nbsp&nbsp My Projects</a></li>\\r\\n          <li><a href=\\\"/construction.html\\\" id=\\\"frangipani-add-new-panel\\\"><i class=\\\"fa fa-stethoscope fa-2x\\\"></i>&nbsp&nbsp&nbsp Gene Panel</a></li>\\r\\n        </ul>\\r\\n      </li>\\r\\n      <li class=\\\"has-form\\\">\\r\\n        <span data-tooltip data-options=\\\"show_on:large\\\" aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-bottom radius\\\" title=\\\"Check annotation status\\\"><a href='/statuspage' class=\\\"button radius alert\\\" id='frangipani-status-page'><i class='fi-annotate size-16'></i></a></span>\\r\\n      </li>\\r\\n      <li class=\\\"has-form\\\">\\r\\n        <a href=\\\"/browsepatients\\\" class=\\\"button radius alert\\\" id=\\\"frangipani-browse-button\\\">Browse</a>\\r\\n      </li>\\r\\n      <li class=\\\"divider hide-for-small\\\">\\r\\n      </li>\\r\\n      <li class=\\\"has-dropdown\\\">\\r\\n        <a href=\\\"#\\\" id=\\\"frangipani-user-icon\\\"><i class=\\\"fi-torso size-14\\\"></i>&nbsp&nbsp\"\n    + alias3(((helper = (helper = helpers.user || (depth0 != null ? depth0.user : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"user\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</a>\\r\\n        <ul class=\\\"dropdown\\\">\\r\\n          <li><label>Account Actions</li></label>\\r\\n          <li><a href=\\\"/setpassword\\\"><i class=\\\"fi-lock size-16\\\"></i>&nbsp&nbsp Change Password</a></li>\\r\\n          <li><a href=\\\"/logout\\\"><i class=\\\"fa fa-sign-out\\\" style=\\\"size:16;\\\"></i>&nbsp&nbspLog Out</a></li>\\r\\n        </ul> \\r\\n      </li>\\r\\n    </ul>\\r\\n    <ul class=\\\"left show-for-small-only\\\">\\r\\n      <li class=\\\"has-dropdown\\\">\\r\\n        <a href=\\\"#\\\" class=\\\"button radius alert\\\"><i class=\\\"fi-list size-16\\\"></i></a>\\r\\n        <ul class=\\\"dropdown\\\">\\r\\n          <li><label>Navigation</label></li>\\r\\n          <li><a href=\\\"/upload\\\" id=\\\"frangipani-add-new-patient\\\">Add Patient</a></li>\\r\\n          <li><a href=\\\"/projects\\\" id=\\\"frangipani-add-new-project\\\">My Projects</a></li>\\r\\n          <li><a href=\\\"/construction.html\\\" id=\\\"frangipani-add-new-panel\\\">Gene Panel</a></li>\\r\\n          <li><a href=\\\"/browsepatients\\\" id=\\\"frangipani-browse-button\\\">Browse</a></li>\\r\\n          <li class=\\\"divider\\\"></li>\\r\\n          <li><label>Account Actions</li>\\r\\n          <li><label>\"\n    + alias3(((helper = (helper = helpers.user || (depth0 != null ? depth0.user : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"user\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</li>\\r\\n          <li><a href=\\\"/setpassword\\\">Change Password</a></li>\\r\\n          <li><a href=\\\"/logout\\\">Log Out</a></li>\\r\\n        </ul>\\r\\n      </li>\\r\\n    </ul>\\r\\n  </section>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<ul class=\\\"title-area\\\">\\r\\n  <li class=\\\"name\\\"><h1><a href=\\\"/\\\">Frangipani</a></h1></li>\\r\\n</ul>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.authenticated : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\");\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],16:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div class=\\\"row\\\">	\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n		<h2><i class=\\\"fi-torsos-all\\\"></i> All Patients (<strong><em>\"\n    + this.escapeExpression(this.lambda(((stack1 = (depth0 != null ? depth0.patients : depth0)) != null ? stack1.length : stack1), depth0))\n    + \"</em></strong>)</h2>\\r\\n	</div>\\r\\n</div>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div class=\\\"row\\\">	\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n		<h4><i class=\\\"fi-torsos-all\\\"></i>Patients(<strong><em id='number-of-patients'>\"\n    + this.escapeExpression(this.lambda(((stack1 = (depth0 != null ? depth0.patients : depth0)) != null ? stack1.length : stack1), depth0))\n    + \"</em></strong>)</h4>\\r\\n	</div>\\r\\n</div>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"	<div class=\\\"row\\\">\\r\\n		<div class=\\\"small-12 medium-12 large-12 small-centered medium-centered large-centered columns\\\">\\r\\n			<table class=\\\"small-12 medium-12 large-12\\\">\\r\\n				<thead>\\r\\n					<tr>\\r\\n						<th>Patient Alias</th>\\r\\n						<th>ID</th>\\r\\n						<th class=\\\"text-center\\\">Sex</th>\\r\\n						<th class=\\\"text-center\\\">Age</th>\\r\\n						<th class=\\\"text-center\\\">Date Uploaded</th>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.project : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(6, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"					</tr>\\r\\n				</thead>\\r\\n				<tbody>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.patients : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(8, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"				</tbody>\\r\\n			</table>\\r\\n		</div>	\\r\\n	</div>\\r\\n\";\n},\"6\":function(depth0,helpers,partials,data) {\n    return \"						<th class=\\\"text-center\\\">Remove</th>\\r\\n\";\n},\"8\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"					<tr class=\\\"patient-row\\\" id=\\\"row-\"\n    + alias3(((helper = (helper = helpers.index || (data && data.index)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"index\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\"	>\\r\\n						<td class=\\\"frangipani-patient-alias\\\">\"\n    + alias3(((helper = (helper = helpers.patient_alias || (depth0 != null ? depth0.patient_alias : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_alias\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</a></td>\\r\\n						<td class=\\\"frangipani-patient-id\\\">\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n						<td class=\\\"text-center\\\">\"\n    + alias3(((helper = (helper = helpers.sex || (depth0 != null ? depth0.sex : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"sex\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n						<td class=\\\"text-center\\\">\"\n    + alias3(((helper = (helper = helpers.age || (depth0 != null ? depth0.age : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"age\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n						<td class=\\\"text-center\\\">\"\n    + alias3(((helper = (helper = helpers.completed || (depth0 != null ? depth0.completed : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"completed\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,((stack1 = (data && data.root)) && stack1.project),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(9, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"					</tr>\\r\\n\";\n},\"9\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"						<td class=\\\"text-center\\\">\\r\\n							<div class=\\\"switch radius tiny\\\">\\r\\n	  							<input id=\\\"removeSwitch-\"\n    + alias3(((helper = (helper = helpers.index || (data && data.index)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"index\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\" type=\\\"checkbox\\\" name=\\\"remove-\"\n    + alias3(((helper = (helper = helpers.index || (data && data.index)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"index\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\" data-id=\\\"\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n	  							<label for=\\\"removeSwitch-\"\n    + alias3(((helper = (helper = helpers.index || (data && data.index)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"index\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\"></label>\\r\\n							</div> \\r\\n						</td>\\r\\n\";\n},\"11\":function(depth0,helpers,partials,data) {\n    return \"	<div class=\\\"row\\\">\\r\\n		<div class=\\\"small-12 large-12\\\">\\r\\n			<div data-alert class=\\\"alert-box radius secondary\\\" id=\\\"error-display-box\\\">\\r\\n		      <!-- Alert message goes here -->\\r\\n		      <div class=\\\"row\\\">\\r\\n		          <div class=\\\"small-11 columns\\\">\\r\\n		              <p id=\\\"error-display-message\\\">There does not appear to be anything here</p>\\r\\n		          </div>\\r\\n		        </div>\\r\\n		    </div>\\r\\n		</div>\\r\\n	</div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.useFull : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.program(3, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.patients : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.program(11, data, 0),\"data\":data})) != null ? stack1 : \"\");\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],17:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"		<h2><i class=\\\"fi-torso\\\"></i> \"\n    + alias3(((helper = (helper = helpers.patientAlias || (depth0 != null ? depth0.patientAlias : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patientAlias\",\"hash\":{},\"data\":data}) : helper)))\n    + \" (<em>\"\n    + alias3(((helper = (helper = helpers.patientID || (depth0 != null ? depth0.patientID : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patientID\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</em>)</h2>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"		<h2><i class=\\\"fi-torso\\\"></i> <em>\"\n    + this.escapeExpression(((helper = (helper = helpers.patientID || (depth0 != null ? depth0.patientID : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"patientID\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</em></h2>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    var stack1, helper, options, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression, buffer = \n  \"<div class=\\\"row\\\">\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n			<div class=\\\"row\\\">\\r\\n				<div class=\\\"large-2 columns\\\">\\r\\n					<h3><strong>\"\n    + alias3(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"key\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</strong></h3>\\r\\n				</div>\\r\\n				<div class=\\\"large-9 columns\\\">\\r\\n					<h3>\\r\\n\"\n    + ((stack1 = (helpers.listPossibleHaplotypes || (depth0 && depth0.listPossibleHaplotypes) || alias1).call(depth0,(data && data.key),{\"name\":\"listPossibleHaplotypes\",\"hash\":{},\"fn\":this.program(6, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"					</h3>\\r\\n				</div>\\r\\n				<div class=\\\"large-1 columns\\\">\\r\\n					<a href=\\\"#\\\"><i class=\\\"fa fa-plus haplotype-expand\\\" gene=\\\"\"\n    + alias3(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"key\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\" expanded=\\\"yes\\\"></i></a>\\r\\n				</div>\\r\\n			</div>\\r\\n			\\r\\n			\\r\\n			<div id=\\\"table\"\n    + alias3(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"key\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\" class=\\\"haplotype-expand-div\\\">\\r\\n				<table>\\r\\n					<thead>\\r\\n						<tr>\\r\\n							<th>Haplotype</th>\\r\\n\"\n    + ((stack1 = (helpers.markerHeader || (depth0 && depth0.markerHeader) || alias1).call(depth0,(data && data.key),{\"name\":\"markerHeader\",\"hash\":{},\"fn\":this.program(6, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"						</tr>\\r\\n					</thead>\\r\\n					<tbody>\\r\\n\";\n  stack1 = ((helper = (helper = helpers.patientGenotypes || (depth0 != null ? depth0.patientGenotypes : depth0)) != null ? helper : alias1),(options={\"name\":\"patientGenotypes\",\"hash\":{},\"fn\":this.program(6, data, 0),\"inverse\":this.noop,\"data\":data}),(typeof helper === alias2 ? helper.call(depth0,options) : helper));\n  if (!helpers.patientGenotypes) { stack1 = helpers.blockHelperMissing.call(depth0,stack1,options)}\n  if (stack1 != null) { buffer += stack1; }\n  return buffer + ((stack1 = helpers.each.call(depth0,depth0,{\"name\":\"each\",\"hash\":{},\"fn\":this.program(8, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"					</tbody>\\r\\n				</table>\\r\\n			</div>\\r\\n	</div>	\\r\\n</div>\\r\\n\";\n},\"6\":function(depth0,helpers,partials,data) {\n    return \"\";\n},\"8\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing;\n\n  return \"						<tr>\\r\\n							<td>\"\n    + this.escapeExpression(((helper = (helper = helpers.key || (data && data.key)) != null ? helper : alias1),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"key\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n\"\n    + ((stack1 = (helpers.haplotypeMarkers || (depth0 && depth0.haplotypeMarkers) || alias1).call(depth0,(data && data.key),{\"name\":\"haplotypeMarkers\",\"hash\":{},\"fn\":this.program(6, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"						</tr>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"<div class=\\\"row\\\">	\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.patientAlias : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.program(3, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"\\r\\n		<h5 style=\\\"margin-top: 30px;\\\">Pharmacogenomic results based on phased and unphased genotypes from this sample.</h5>\\r\\n		<h6 style=\\\"margin-bottom: 40px;\\\"><em><a href=\\\"#\\\" id=\\\"collapse-all-haplotypes\\\">Show less</a></em></h6></p>\\r\\n	</div>\\r\\n</div>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.pgxGenes : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"<div class=\\\"row\\\">	\\r\\n	<div class=\\\"large-12 columns\\\" style=\\\"margin-top: 40px; margin-bottom: 20px;\\\">\\r\\n		<h5><strong>Disclaimer</strong></h5>\\r\\n		<h6>\"\n    + alias3(((helper = (helper = helpers.disclaimer || (depth0 != null ? depth0.disclaimer : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"disclaimer\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h6>\\r\\n	</div>\\r\\n</div>\\r\\n<div class=\\\"row\\\">	\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n		<h6><em>\"\n    + alias3(((helper = (helper = helpers['report-footer'] || (depth0 != null ? depth0['report-footer'] : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"report-footer\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</em></h6>\\r\\n	</div>\\r\\n</div>\\r\\n\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],18:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    return \"<div class=\\\"row\\\">\\r\\n    <div class=\\\"large-12 columns\\\" style=\\\"margin-top:20px\\\">\\r\\n        <a href=\\\"/projects\\\" class=\\\"button radius\\\"><i class=\\\"fa fa-arrow-left\\\"></i>&nbspBack</a>\\r\\n      	<h2><i class=\\\"fi-page-multiple\\\"></i>&nbsp&nbspAdd New Project</h2>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\">\\r\\n            <form id=\\\"frangipani-add-new-project\\\" style=\\\"margin-top:40px\\\">\\r\\n              <fieldset>\\r\\n                <legend>Project Information </legend>\\r\\n                <div class=\\\"row\\\">\\r\\n                <div class=\\\"small-12 columns\\\">\\r\\n                  <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                    <!-- Alert message goes here -->\\r\\n                    <div class=\\\"row\\\">\\r\\n                      <div class=\\\"small-11 columns\\\">\\r\\n                        <p id=\\\"error-display-message\\\"></p>\\r\\n                      </div>\\r\\n                      <div class=\\\"small-1 columns\\\">\\r\\n                        <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-12 columns\\\">\\r\\n            	      <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Project Name</span></span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='project_id' name='project_id'> \\r\\n                        <small class=\\\"error\\\" style=\\\"display:none;\\\">That project Id alredy exists</small>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Keywords</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='keywords' name='keywords'>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Project Description</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <textarea id=\\\"description\\\" rows=5></textarea>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius postfix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Add Authorized User</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-8 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='new-user' name='new-user'>\\r\\n                        <small class=\\\"error\\\" style=\\\"display:none\\\">That user does not exist</small>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-1 columns\\\">\\r\\n                        <a href=\\\"#\\\" class=\\\"postfix button secondary\\\" id=\\\"add-auth-user\\\"><i class=\\\"fi-plus\\\"></i></a>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Authorized Users</span></span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <table class=\\\"large-12\\\">\\r\\n                          <thead>\\r\\n                            <tr>\\r\\n                              <th class=\\\"large-9\\\">Email</th>\\r\\n                              <th class=\\\"large-3 text-center\\\">Remove</th>\\r\\n                            </tr>\\r\\n                          <tbody id='auth-users'>\\r\\n                            <tr>\\r\\n                              <td>You</td>\\r\\n                              <td class='text-center'>Cannot Remove</td>\\r\\n                            </tr>\\r\\n                          </tbody>\\r\\n                        </table>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n          	    </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-12 columns\\\" id='patient_id_links' style=\\\"min-height:150px;\\\">\\r\\n                    <div class=\\\"large-8 columns\\\">\\r\\n                      <h4>Patients to add to project</h4>\\r\\n                    </div>\\r\\n                    <div class=\\\"large-3 columns right\\\">\\r\\n                      <a href=\\\"#\\\" id=\\\"remove-all-visible\\\" class=\\\"tiny button radius alert right\\\">Remove All Patients</a>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-4 columns\\\">\\r\\n                    <a href=\\\"#\\\" class=\\\"button alert round large-12\\\" id=\\\"submit-new-project\\\">Submit</a>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </fieldset>\\r\\n            </form>\\r\\n          </div>\\r\\n        </div>\\r\\n        <hr>\\r\\n        <div  class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\">\\r\\n            <p>Search through the available patients and select those that you would like to add to your new project. To add a patient simply click on them in the table!</p> \\r\\n            <div class=\\\"row collapse prefix-radius\\\">\\r\\n              <div class=\\\"large-2 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Search</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-6 small-8 columns left\\\">\\r\\n                <input type=\\\"text\\\" id=\\\"searchBox\\\" name=\\\"searchBox\\\">\\r\\n              </div>\\r\\n              <div class=\\\"large-3 small-2 columns right\\\">\\r\\n                <a href=\\\"#\\\" id=\\\"add-all-visible\\\" class=\\\"right tiny button alert radius\\\">Add All Active Patients</a>\\r\\n              </div>\\r\\n            </div>\\r\\n            <div class=\\\"large-12 columns\\\" id=\\\"patient-information\\\">\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n    </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],19:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"<tr>\\r\\n	<td class=\\\"auth-user-email\\\">\"\n    + this.escapeExpression(((helper = (helper = helpers.user || (depth0 != null ? depth0.user : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"user\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n	<td class='text-center'><a href=\\\"#\\\"><i class=\\\"fi-x size-16\\\"></i></td>\\r\\n</tr>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],20:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    return \"	    	<div class=\\\"large-3 columns\\\">\\r\\n	    		<a href=\\\"#\\\" class=\\\"button radius right\\\" id='delete-project'>Delete Project</a>\\r\\n	    	</div>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    return \"          <div class=\\\"large-2 columns text-center\\\">\\r\\n            <a href=\\\"#\\\" id=\\\"edit-page\\\"><i class=\\\"fi-pencil size-24\\\" style=\\\"color:#A2A2A2\\\"></i></a>\\r\\n          </div>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"\\r\\n        		<h4>Project Keywords</h4>\\r\\n        		<p>\"\n    + this.escapeExpression(((helper = (helper = helpers.keywords || (depth0 != null ? depth0.keywords : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"keywords\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</p>\\r\\n\";\n},\"7\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"        		<h4>Project Description</h4>\\r\\n        		<p>\"\n    + this.escapeExpression(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"description\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</p>\\r\\n\";\n},\"9\":function(depth0,helpers,partials,data) {\n    var alias1=this.lambda, alias2=this.escapeExpression;\n\n  return \"    	    		<span class=\\\"button radius secondary\\\" data-id=\\\"\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\">\"\n    + alias2(alias1(depth0, depth0))\n    + \"</span>\\r\\n\";\n},\"11\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\" style=\\\"display:none;\\\" id=\\\"change-details\\\">\\r\\n            <h4>Project Keywords</h4>\\r\\n            <input type=\\\"text\\\" id=\\\"keywords\\\" value=\\\"\"\n    + alias3(((helper = (helper = helpers.keywords || (depth0 != null ? depth0.keywords : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"keywords\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n            <h4>Project Description</h4>\\r\\n            <textarea id=\\\"description\\\" rows=5>\"\n    + alias3(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"description\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</textarea>\\r\\n            <div class=\\\"row collapse prefix-radius postfix-radius\\\">\\r\\n              <div class=\\\"large-3 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Add Authorized User</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-8 columns\\\">\\r\\n                <input type=\\\"text\\\" id='new-user' name='new-user'>\\r\\n                <small class=\\\"error\\\" style=\\\"display:none\\\">That user does not exist</small>\\r\\n              </div>\\r\\n              <div class=\\\"large-1 columns\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"postfix button secondary\\\" id=\\\"add-auth-user\\\"><i class=\\\"fi-plus\\\"></i></a>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"large-12 columns\\\">\\r\\n              <table class=\\\"large-12\\\">\\r\\n                <thead>\\r\\n                  <tr>\\r\\n                    <th class=\\\"large-9\\\">Email</th>\\r\\n                    <th class=\\\"large-3 text-center\\\">Remove</th>\\r\\n                  </tr>\\r\\n                <tbody id='auth-users'>\\r\\n                  <tr>\\r\\n                    <td>Owner</td>\\r\\n                    <td class=\\\"text-center\\\">Cannot Remove</td>\\r\\n                  </tr>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.users : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(12, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </tbody>\\r\\n              </table>\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class='large-6 columns' style=\\\"margin-top:40px\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"button radius large-12 left confirm success\\\">Submit</a>\\r\\n              </div>\\r\\n              <div class='large-6 columns' style=\\\"margin-top:40px\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"button radius alert large-12 right cancel\\\">cancel</a>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n\";\n},\"12\":function(depth0,helpers,partials,data) {\n    var alias1=this.lambda, alias2=this.escapeExpression;\n\n  return \"                  <tr>\\r\\n                    <td class=\\\"auth-user-email\\\" data-id=\\\"\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\">\"\n    + alias2(alias1(depth0, depth0))\n    + \"</td>\\r\\n                    <td class='text-center'><a href=\\\"#\\\"><i class=\\\"fi-x size-16\\\"></i></td>\\r\\n                  </tr>\\r\\n\";\n},\"14\":function(depth0,helpers,partials,data) {\n    return \"    	<div class=\\\"row\\\">\\r\\n    		<div class=\\\"large-4 columns\\\">\\r\\n    			<a href=\\\"#\\\" class=\\\"button alert radius\\\" id=\\\"add-patients\\\">Add Patients to Project</a>\\r\\n    		</div>\\r\\n    		<div class=\\\"large-8 columns right\\\">\\r\\n    			<a href=\\\"#\\\" class=\\\"button alert radius right\\\" id=\\\"remove-patients\\\">Remove Patients From Project</a>\\r\\n    		</div>\\r\\n    	</div>\\r\\n\\r\\n    	<div id=\\\"add-patients-modal\\\" class=\\\"reveal-modal large\\\" data-reveal>\\r\\n		  	<h2>Select Which patients you would like to add</h2>\\r\\n		  	<div class=\\\"row\\\">\\r\\n                <div class=\\\"large-12 columns\\\" id='patient_id_links' style=\\\"min-height:100px;margin-bottom:20px\\\">\\r\\n                  <h4>Patients to add to project (click to remove)</h4>\\r\\n                </div>\\r\\n          	</div>\\r\\n\\r\\n          	<div class=\\\"row collapse prefix-radius\\\">\\r\\n              <div class=\\\"large-2 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Search</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-6 columns left\\\">\\r\\n                <input type=\\\"text\\\" id=\\\"searchBox\\\" name=\\\"searchBox\\\">\\r\\n              </div>\\r\\n            </div>\\r\\n          	<div class=\\\"row\\\">\\r\\n          		<div class=\\\"scrollit large-12 columns\\\" id=\\\"patient-information\\\">\\r\\n          		</div>\\r\\n            </div>\\r\\n\\r\\n		  	<div class=\\\"row\\\">\\r\\n		  		<div class='large-6 columns'>\\r\\n		  			<a href=\\\"#\\\" class=\\\"large-12 button radius success confirm\\\">Confirm</a>\\r\\n		  		</div>\\r\\n		  		<div class=\\\"large-6 columns\\\">\\r\\n		  			<a href=\\\"#\\\" class=\\\"large-12 button radius alert cancel\\\">Cancel</a>\\r\\n		  		</div>\\r\\n		  	</div>\\r\\n		  	<a class=\\\"close-reveal-modal\\\">&#215;</a>\\r\\n		</div>\\r\\n\\r\\n		<div id=\\\"confirm-removal\\\" class=\\\"reveal-modal large\\\" data-reveal>\\r\\n		  <h3></h3>\\r\\n		  <div class=\\\"row\\\">\\r\\n		  	<div class='large-6 columns'>\\r\\n		  		<a href=\\\"#\\\" class=\\\"large-12 button radius success confirm\\\">Confirm</a>\\r\\n		  	</div>\\r\\n		  	<div class=\\\"large-6 columns\\\">\\r\\n		  		<a href=\\\"#\\\"class=\\\"large-12 button radius alert cancel\\\">Cancel</a>\\r\\n		  	</div>\\r\\n		  </div>\\r\\n		  <a class=\\\"close-reveal-modal\\\">&#215;</a>\\r\\n		</div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"    <div class=\\\"row\\\">\\r\\n    	<div class=\\\"large-12 columns\\\" style=\\\"margin-top:20px\\\">\\r\\n\\r\\n    	<a href=\\\"/projects\\\" class=\\\"button radius\\\"><i class=\\\"fa fa-arrow-left\\\"></i>&nbspBack</a>\\r\\n    	<div class=\\\"row\\\">\\r\\n	    	<div class=\\\"large-9 columns\\\">\\r\\n	    		<h2><i class=\\\"fi-book\\\"></i>&nbsp\"\n    + alias3(((helper = (helper = helpers.project_id || (depth0 != null ? depth0.project_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"project_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h2>\\r\\n	    	</div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"	    </div>\\r\\n	    \\r\\n    	<fieldset>\\r\\n    		<legend>Project Information</legend>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-10 columns\\\">\\r\\n    		    <h4>Created on: \"\n    + alias3(((helper = (helper = helpers.date || (depth0 != null ? depth0.date : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"date\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h4>\\r\\n          </div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"        </div>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\" id=\\\"fixed-details\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.keywords : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.description : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(7, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"        		<h4>Authorized Users</h4>\\r\\n            <span class=\\\"button radius secondary\\\" data-id=\\\"\"\n    + alias3(((helper = (helper = helpers.owner || (depth0 != null ? depth0.owner : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"owner\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\"\n    + alias3(((helper = (helper = helpers.owner || (depth0 != null ? depth0.owner : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"owner\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</span>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.users : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(9, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"          </div>\\r\\n        </div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(11, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"      </fieldset>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(14, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"		<div class=\\\"row\\\">\\r\\n      <div class=\\\"small-12 columns\\\">\\r\\n          <div data-alert class=\\\"alert-box radius secondary\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n          <!-- Alert message goes here -->\\r\\n          	<div class=\\\"row\\\">\\r\\n              	<div class=\\\"small-11 columns\\\">\\r\\n                 		<p id=\\\"error-display-message\\\"></p>\\r\\n              	</div>\\r\\n              	<div class=\\\"small-1 columns\\\">\\r\\n                  	<a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n              	</div>\\r\\n          	</div>\\r\\n      	</div>\\r\\n  	</div>\\r\\n  </div>\\r\\n	<div class=\\\"row\\\">\\r\\n		<div class=\\\"large-12 columns\\\" id=\\\"patients-table\\\">\\r\\n		</div>\\r\\n	</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],21:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div class=\\\"row\\\">\\r\\n    <div class=\\\"large-12 columns\\\">\\r\\n      	<h2><i class=\\\"fi-page-multiple\\\"></i>&nbsp Projects</h2>\\r\\n      	<h5 class=\\\"subheader\\\">Displaying all available projects</h5>\\r\\n     	<p>Projects offer you a way to conveniently group individual patients together to easily view information that is being stored for each of them. A single patient can be included in as many projects as you want. Additionally projects also offer you the opportunity to share patients with individuals by granting them access to a patient. Just a warning, granting someone privileges means they can also grant another individual privileges as well.</p>\\r\\n      	<div class=\\\"row\\\">\\r\\n        	<div class=\\\"large-3 columns\\\">\\r\\n          		<a href=\\\"#\\\" class=\\\"button alert radius left\\\" id=\\\"add-new-project\\\">Add New Project</a>\\r\\n        	</div>\\r\\n      	</div> \\r\\n    </div>\\r\\n</div>\\r\\n<div class=\\\"row\\\">\\r\\n	<div class=\\\"large-12 columns\\\">     \\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.projects : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(2, data, 0),\"inverse\":this.program(5, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"	</div>\\r\\n</div>\\r\\n\";\n},\"2\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"  		<table class=\\\"large-12\\\">\\r\\n  			<thead>\\r\\n  				<tr>\\r\\n  					<th>Project Name</th>\\r\\n  					<th>Date Created</th>\\r\\n  					<th class=\\\"text-center\\\">Number Of Patients</th>\\r\\n  					<th class=\\\"text-center\\\">Keywords</th>\\r\\n  				</tr>\\r\\n  			</thead>\\r\\n  			<tbody>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.projects : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"  			</tbody>\\r\\n  		</table>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"  				<tr class=\\\"project-row\\\">\\r\\n  					<td class=\\\"frangipani-project-name\\\">\"\n    + alias3(((helper = (helper = helpers.project_id || (depth0 != null ? depth0.project_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"project_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</a></td>\\r\\n  					<td>\"\n    + alias3(((helper = (helper = helpers.date || (depth0 != null ? depth0.date : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"date\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n  					<td class=\\\"text-center\\\">\"\n    + alias3(((helper = (helper = helpers.numPatients || (depth0 != null ? depth0.numPatients : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"numPatients\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n  					<td class=\\\"text-center\\\">\"\n    + alias3(((helper = (helper = helpers.keywords || (depth0 != null ? depth0.keywords : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"keywords\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n  				</tr>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    return \"    <div data-alert class=\\\"alert-box radius secondary\\\" id=\\\"error-display-box\\\">\\r\\n      <!-- Alert message goes here -->\\r\\n      <div class=\\\"row\\\">\\r\\n          <div class=\\\"small-11 columns\\\">\\r\\n              <p id=\\\"error-display-message\\\">There does not appear to be anything here</p>\\r\\n          </div>\\r\\n        </div>\\r\\n    </div>\\r\\n\";\n},\"7\":function(depth0,helpers,partials,data) {\n    return \"<div class=\\\"row\\\">\\r\\n    <div class=\\\"large-12 columns\\\" style=\\\"margin-top:20px\\\">\\r\\n        <a href=\\\"/projects\\\" class=\\\"button radius\\\"><i class=\\\"fa fa-arrow-left\\\"></i>&nbspBack</a>\\r\\n      	<h2><i class=\\\"fi-page-multiple\\\"></i>&nbsp&nbspAdd New Project</h2>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\">\\r\\n            <form id=\\\"frangipani-add-new-project\\\" style=\\\"margin-top:40px\\\">\\r\\n              <fieldset>\\r\\n                <legend>Project Information </legend>\\r\\n                <div class=\\\"row\\\">\\r\\n                <div class=\\\"small-12 columns\\\">\\r\\n                  <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                    <!-- Alert message goes here -->\\r\\n                    <div class=\\\"row\\\">\\r\\n                      <div class=\\\"small-11 columns\\\">\\r\\n                        <p id=\\\"error-display-message\\\"></p>\\r\\n                      </div>\\r\\n                      <div class=\\\"small-1 columns\\\">\\r\\n                        <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-12 columns\\\">\\r\\n            	      <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Project Name</span></span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='project_id' name='project_id'> \\r\\n                        <small class=\\\"error\\\" style=\\\"display:none;\\\">That project Id alredy exists</small>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Keywords</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='keywords' name='keywords'>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Project Description</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <textarea id=\\\"description\\\" rows=5></textarea>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius postfix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Add Authorized User</span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-8 columns\\\">\\r\\n                        <input type=\\\"text\\\" id='new-user' name='new-user'>\\r\\n                        <small class=\\\"error\\\" style=\\\"display:none\\\">That user does not exist</small>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-1 columns\\\">\\r\\n                        <a href=\\\"#\\\" class=\\\"postfix button secondary\\\" id=\\\"add-auth-user\\\"><i class=\\\"fi-plus\\\"></i></a>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                    <div class=\\\"row collapse prefix-radius\\\">\\r\\n                      <div class=\\\"large-3 columns\\\">\\r\\n                        <span class=\\\"prefix\\\">Authorized Users</span></span>\\r\\n                      </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <table class=\\\"large-12\\\">\\r\\n                          <thead>\\r\\n                            <tr>\\r\\n                              <th class=\\\"large-9\\\">Email</th>\\r\\n                              <th class=\\\"large-3 text-center\\\">Remove</th>\\r\\n                            </tr>\\r\\n                          <tbody id='auth-users'>\\r\\n                            <tr>\\r\\n                              <td>You</td>\\r\\n                              <td class='text-center'>Cannot Remove</td>\\r\\n                            </tr>\\r\\n                          </tbody>\\r\\n                        </table>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n          	    </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-12 columns\\\" id='patient_id_links' style=\\\"min-height:150px;\\\">\\r\\n                    <div class=\\\"large-8 columns\\\">\\r\\n                      <h4>Patients to add to project</h4>\\r\\n                    </div>\\r\\n                    <div class=\\\"large-3 columns right\\\">\\r\\n                      <a href=\\\"#\\\" id=\\\"remove-all-visible\\\" class=\\\"tiny button radius alert right\\\">Remove All Patients</a>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-4 columns\\\">\\r\\n                    <a href=\\\"#\\\" class=\\\"button alert round large-12\\\" id=\\\"submit-new-project\\\">Submit</a>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </fieldset>\\r\\n            </form>\\r\\n          </div>\\r\\n        </div>\\r\\n        <hr>\\r\\n        <div  class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\">\\r\\n            <p>Search through the available patients and select those that you would like to add to your new project. To add a patient simply click on them in the table!</p> \\r\\n            <div class=\\\"row collapse prefix-radius\\\">\\r\\n              <div class=\\\"large-2 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Search</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-6 small-8 columns left\\\">\\r\\n                <input type=\\\"text\\\" id=\\\"searchBox\\\" name=\\\"searchBox\\\">\\r\\n              </div>\\r\\n              <div class=\\\"large-3 small-2 columns right\\\">\\r\\n                <a href=\\\"#\\\" id=\\\"add-all-visible\\\" class=\\\"right tiny button alert radius\\\">Add All Active Patients</a>\\r\\n              </div>\\r\\n            </div>\\r\\n            <div class=\\\"large-12 columns\\\" id=\\\"patient-information\\\">\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n    </div>\\r\\n</div>\\r\\n\";\n},\"9\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"	<div class=\\\"row\\\">\\r\\n    	<div class=\\\"large-12 columns\\\" style=\\\"margin-top:20px\\\">\\r\\n\\r\\n    	<a href=\\\"/projects\\\" class=\\\"button radius\\\"><i class=\\\"fa fa-arrow-left\\\"></i>&nbspBack</a>\\r\\n    	<div class=\\\"row\\\">\\r\\n	    	<div class=\\\"large-9 columns\\\">\\r\\n	    		<h2><i class=\\\"fi-book\\\"></i>&nbsp\"\n    + alias3(((helper = (helper = helpers.project_id || (depth0 != null ? depth0.project_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"project_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h2>\\r\\n	    	</div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(10, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"	    </div>\\r\\n	    \\r\\n    	<fieldset>\\r\\n    		<legend>Project Information</legend>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-10 columns\\\">\\r\\n    		    <h4>Created on: \"\n    + alias3(((helper = (helper = helpers.date || (depth0 != null ? depth0.date : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"date\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</h4>\\r\\n          </div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(12, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"        </div>\\r\\n        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\" id=\\\"fixed-details\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.keywords : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(14, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.description : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(16, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"        		<h4>Authorized Users</h4>\\r\\n            <span class=\\\"button radius secondary\\\" data-id=\\\"\"\n    + alias3(((helper = (helper = helpers.owner || (depth0 != null ? depth0.owner : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"owner\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\"\n    + alias3(((helper = (helper = helpers.owner || (depth0 != null ? depth0.owner : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"owner\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</span>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.users : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(18, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"          </div>\\r\\n        </div>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(20, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"      </fieldset>\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.isOwner : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(23, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"		<div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n                <div data-alert class=\\\"alert-box radius secondary\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                <!-- Alert message goes here -->\\r\\n                	<div class=\\\"row\\\">\\r\\n                    	<div class=\\\"small-11 columns\\\">\\r\\n                       		<p id=\\\"error-display-message\\\"></p>\\r\\n                    	</div>\\r\\n                    	<div class=\\\"small-1 columns\\\">\\r\\n                        	<a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                    	</div>\\r\\n                	</div>\\r\\n            	</div>\\r\\n        	</div>\\r\\n        </div>\\r\\n\\r\\n\\r\\n    	<div class=\\\"row\\\">\\r\\n    		<div class=\\\"large-12 columns\\\" id=\\\"patients-table\\\">\\r\\n    		</div>\\r\\n    	</div>\\r\\n\";\n},\"10\":function(depth0,helpers,partials,data) {\n    return \"	    	<div class=\\\"large-3 columns\\\">\\r\\n	    		<a href=\\\"#\\\" class=\\\"button radius right\\\" id='delete-project'>Delete Project</a>\\r\\n	    	</div>\\r\\n\";\n},\"12\":function(depth0,helpers,partials,data) {\n    return \"          <div class=\\\"large-2 columns text-center\\\">\\r\\n            <a href=\\\"#\\\" id=\\\"edit-page\\\"><i class=\\\"fi-pencil size-24\\\" style=\\\"color:#A2A2A2\\\"></i></a>\\r\\n          </div>\\r\\n\";\n},\"14\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"\\r\\n        		<h4>Project Keywords</h4>\\r\\n        		<p>\"\n    + this.escapeExpression(((helper = (helper = helpers.keywords || (depth0 != null ? depth0.keywords : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"keywords\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</p>\\r\\n\";\n},\"16\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"        		<h4>Project Description</h4>\\r\\n        		<p>\"\n    + this.escapeExpression(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"description\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</p>\\r\\n\";\n},\"18\":function(depth0,helpers,partials,data) {\n    var alias1=this.lambda, alias2=this.escapeExpression;\n\n  return \"    	    		<span class=\\\"button radius secondary\\\" data-id=\\\"\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\">\"\n    + alias2(alias1(depth0, depth0))\n    + \"</span>\\r\\n\";\n},\"20\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"        <div class=\\\"row\\\">\\r\\n          <div class=\\\"large-12 columns\\\" style=\\\"display:none;\\\" id=\\\"change-details\\\">\\r\\n            <h4>Project Keywords</h4>\\r\\n            <input type=\\\"text\\\" id=\\\"keywords\\\" value=\\\"\"\n    + alias3(((helper = (helper = helpers.keywords || (depth0 != null ? depth0.keywords : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"keywords\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n            <h4>Project Description</h4>\\r\\n            <textarea id=\\\"description\\\" rows=5>\"\n    + alias3(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"description\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</textarea>\\r\\n            <div class=\\\"row collapse prefix-radius postfix-radius\\\">\\r\\n              <div class=\\\"large-3 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Add Authorized User</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-8 columns\\\">\\r\\n                <input type=\\\"text\\\" id='new-user' name='new-user'>\\r\\n                <small class=\\\"error\\\" style=\\\"display:none\\\">That user does not exist</small>\\r\\n              </div>\\r\\n              <div class=\\\"large-1 columns\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"postfix button secondary\\\" id=\\\"add-auth-user\\\"><i class=\\\"fi-plus\\\"></i></a>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"large-12 columns\\\">\\r\\n              <table class=\\\"large-12\\\">\\r\\n                <thead>\\r\\n                  <tr>\\r\\n                    <th class=\\\"large-9\\\">Email</th>\\r\\n                    <th class=\\\"large-3 text-center\\\">Remove</th>\\r\\n                  </tr>\\r\\n                <tbody id='auth-users'>\\r\\n                  <tr>\\r\\n                    <td>Owner</td>\\r\\n                    <td class=\\\"text-center\\\">Cannot Remove</td>\\r\\n                  </tr>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.users : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(21, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </tbody>\\r\\n              </table>\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class='large-6 columns' style=\\\"margin-top:40px\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"button radius large-12 left confirm success\\\">Submit</a>\\r\\n              </div>\\r\\n              <div class='large-6 columns' style=\\\"margin-top:40px\\\">\\r\\n                <a href=\\\"#\\\" class=\\\"button radius alert large-12 right cancel\\\">cancel</a>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n        </div>\\r\\n\";\n},\"21\":function(depth0,helpers,partials,data) {\n    var alias1=this.lambda, alias2=this.escapeExpression;\n\n  return \"                  <tr>\\r\\n                    <td class=\\\"auth-user-email\\\" data-id=\\\"\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\">\"\n    + alias2(alias1(depth0, depth0))\n    + \"</td>\\r\\n                    <td class='text-center'><a href=\\\"#\\\"><i class=\\\"fi-x size-16\\\"></i></td>\\r\\n                  </tr>\\r\\n\";\n},\"23\":function(depth0,helpers,partials,data) {\n    return \"    	<div class=\\\"row\\\">\\r\\n    		<div class=\\\"large-4 columns\\\">\\r\\n    			<a href=\\\"#\\\" class=\\\"button alert radius\\\" id=\\\"add-patients\\\">Add Patients to Project</a>\\r\\n    		</div>\\r\\n    		<div class=\\\"large-8 columns right\\\">\\r\\n    			<a href=\\\"#\\\" class=\\\"button alert radius right\\\" id=\\\"remove-patients\\\">Remove Patients From Project</a>\\r\\n    		</div>\\r\\n    	</div>\\r\\n\\r\\n    	<div id=\\\"add-patients-modal\\\" class=\\\"reveal-modal large\\\" data-reveal>\\r\\n		  	<h2>Select Which patients you would like to add</h2>\\r\\n		  	<div class=\\\"row\\\">\\r\\n                <div class=\\\"large-12 columns\\\" id='patient_id_links' style=\\\"min-height:100px;margin-bottom:20px\\\">\\r\\n                  <h4>Patients to add to project (click to remove)</h4>\\r\\n                </div>\\r\\n          	</div>\\r\\n\\r\\n          	<div class=\\\"row collapse prefix-radius\\\">\\r\\n              <div class=\\\"large-2 columns\\\">\\r\\n                <span class=\\\"prefix\\\">Search</span>\\r\\n              </div>\\r\\n              <div class=\\\"large-6 columns left\\\">\\r\\n                <input type=\\\"text\\\" id=\\\"searchBox\\\" name=\\\"searchBox\\\">\\r\\n              </div>\\r\\n            </div>\\r\\n          	<div class=\\\"row\\\">\\r\\n          		<div class=\\\"scrollit large-12 columns\\\" id=\\\"patient-information\\\">\\r\\n          		</div>\\r\\n            </div>\\r\\n\\r\\n		  	<div class=\\\"row\\\">\\r\\n		  		<div class='large-6 columns'>\\r\\n		  			<a href=\\\"#\\\" class=\\\"large-12 button radius success confirm\\\">Confirm</a>\\r\\n		  		</div>\\r\\n		  		<div class=\\\"large-6 columns\\\">\\r\\n		  			<a href=\\\"#\\\" class=\\\"large-12 button radius alert cancel\\\">Cancel</a>\\r\\n		  		</div>\\r\\n		  	</div>\\r\\n		  	<a class=\\\"close-reveal-modal\\\">&#215;</a>\\r\\n		</div>\\r\\n\\r\\n		<div id=\\\"confirm-removal\\\" class=\\\"reveal-modal large\\\" data-reveal>\\r\\n		  <h3></h3>\\r\\n		  <div class=\\\"row\\\">\\r\\n		  	<div class='large-6 columns'>\\r\\n		  		<a href=\\\"#\\\" class=\\\"large-12 button radius success confirm\\\">Confirm</a>\\r\\n		  	</div>\\r\\n		  	<div class=\\\"large-6 columns\\\">\\r\\n		  		<a href=\\\"#\\\"class=\\\"large-12 button radius alert cancel\\\">Cancel</a>\\r\\n		  	</div>\\r\\n		  </div>\\r\\n		  <a class=\\\"close-reveal-modal\\\">&#215;</a>\\r\\n		</div>\\r\\n\";\n},\"25\":function(depth0,helpers,partials,data) {\n    var helper;\n\n  return \"	<tr>\\r\\n		<td class=\\\"auth-user-email\\\">\"\n    + this.escapeExpression(((helper = (helper = helpers.user || (depth0 != null ? depth0.user : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"user\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n		<td class='text-center'><a href=\\\"#\\\"><i class=\\\"fi-x size-16\\\"></i></td>\\r\\n	</tr>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.projectPage : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"\\r\\n\\r\\n\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.addProjectPage : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(7, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"\\r\\n\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.projectInfoPage : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(9, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"\\r\\n\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.addAuthUser : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(25, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\");\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],22:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    return \"                    <span>Return to <a href=\\\"/login\\\">login</a></span>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    return \"                    <span>First time Here? <a href=\\\"/signup\\\">Signup</a></span>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    return \"                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-2 columns\\\">\\r\\n                    <h4>Or</h4>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-12 columns small-centered text-center\\\">\\r\\n                    <a href=\\\"/auth/google\\\" ><img src=\\\"img/signin1.png\\\" class=\\\"small-12 small-centered \\\"style=\\\"width:60%;height:60%\\\"></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div id=\\\"frangipani-login-page\\\" style=\\\"min-height:100%;\\\">\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"large-6 large-centered columns\\\">\\r\\n      <form data-abide='ajax' id=\\\"frangipani-request-login\\\" style=\\\"margin-top:20%\\\">\\r\\n        <fieldset>\\r\\n          <h3 style=\\\"margin-bottom:60px;margin-top:10px;\\\"><i class=\\\"fa fa-chevron-right\\\"></i>&nbspRecover Password</h3>\\r\\n          <p style=\\\"margin-bottom:20px;\\\">Please enter your username. An email will be sent to the registered email address with a temporary password within the next few minutes.</p>\\r\\n          <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                <!-- Alert message goes here -->\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"small-11 columns\\\">\\r\\n                <p id=\\\"error-display-message\\\"></p>\\r\\n              </div>\\r\\n              <div class=\\\"small-1 columns\\\">\\r\\n                <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" >\\r\\n            <div class=\\\"large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"large-3 columns\\\">\\r\\n                  <span class=\\\"prefix\\\"><i class=\\\"fa fa-envelope-o fa-lg\\\"></i></span>\\r\\n                </div>\\r\\n                <div class=\\\"large-9 columns\\\">\\r\\n                  <input type=\\\"email\\\" id='username' name='username' required>\\r\\n                  <small class=\\\"error\\\">A valid email is required</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" style=\\\"margin-top:20px;\\\">\\r\\n            <div class=\\\"large-3 columns\\\">\\r\\n              <button type=\\\"submit\\\" class=\\\"button radius alert\\\">Send</button>\\r\\n            </div>\\r\\n            <div class=\\\"large-9 columns\\\">\\r\\n                <div class=\\\"large-12 columns\\\" id=\\\"extra-field-1\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.login : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </div>\\r\\n                <div class=\\\"large-12 columns\\\" id=\\\"extra-field-2\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.signup : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"large-12 columns\\\" id=\\\"extra-field-3\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.oauth : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"            </div>\\r\\n          </div>\\r\\n        </fieldset>\\r\\n      </form>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],23:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var alias1=this.lambda, alias2=this.escapeExpression;\n\n  return \"                            <tr>\\r\\n                              <td><p style=\\\"margin-bottom: 0px;\\\">\"\n    + alias2(alias1(depth0, depth0))\n    + \"</p></td>\\r\\n                              <td>\\r\\n                                <div class=\\\"switch small radius\\\">\\r\\n                                  <input id=\\\"frangipani-annovar-annotation-\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\" name=\\\"frangipani-annovar-annotation-\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\" type=\\\"checkbox\\\" value=\\\"\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\" checked>\\r\\n                                  <label for=\\\"frangipani-annovar-annotation-\"\n    + alias2(alias1(depth0, depth0))\n    + \"\\\"></label>\\r\\n                                </div>\\r\\n                              </td>\\r\\n                            </tr>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"	<div class=\\\"row\\\">\\r\\n        <div class=\\\"large-10 large-centered columns\\\">\\r\\n          <h1>Welcome!</h1>\\r\\n          <h5 class=\\\"subheader\\\">\\r\\n            We've built <i>Frangipani</i> to make genome interpretation easier for clinicians.\\r\\n          </h5>\\r\\n        </div>\\r\\n        <div class=\\\"large-10 large-centered columns\\\">\\r\\n          <h2>Let's get you set up</h2>\\r\\n          <h5 class=\\\"subheader\\\">\\r\\n            It's time to configure your Frangipani server. We've made some suggestions where possible\\r\\n            if you're not sure what to enter.\\r\\n          </h5>\\r\\n        </div>\\r\\n      </div>\\r\\n\\r\\n      <!-- Config form -->\\r\\n      <div class=\\\"row\\\">\\r\\n        <div class=\\\"large-10 large-centered columns\\\">\\r\\n\\r\\n          <form data-abide=\\\"ajax\\\" id=\\\"frangipani-config-form\\\">\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-12 large-centered columns\\\">\\r\\n                <div class=\\\"row collapse prefix-radius\\\">\\r\\n                  <div class=\\\"large-3 columns\\\">\\r\\n                    <span class=\\\"prefix\\\">Your Institution's Name</span>\\r\\n                  </div>\\r\\n                  <div class=\\\"large-9 columns\\\">\\r\\n                      <input type=\\\"text\\\" id=\\\"frangipani-institution\\\" name=\\\"institution\\\" required/>\\r\\n                      <small class=\\\"error\\\">Institution name required.</small>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-12 large-centered columns\\\">\\r\\n                <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"tip-left round\\\" title=\\\"We promise not to spam you!\\\">\\r\\n                  <div class=\\\"row collapse prefix-radius\\\">\\r\\n                    <div class=\\\"large-3 columns\\\">\\r\\n                      <span class=\\\"prefix\\\"><i class=\\\"fa fa-envelope-o\\\" style=\\\"font-size: 1.5em;\\\"></i></span>\\r\\n                    </div>\\r\\n                      <div class=\\\"large-9 columns\\\">\\r\\n                        <input type=\\\"email\\\" name=\\\"admin-email\\\" placeholder=\\\"Administrator e-mail\\\" required />\\r\\n                        <small class=\\\"error\\\">An email address is required.</small>\\r\\n                      </div>\\r\\n                  </div>\\r\\n                </span>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <fieldset>\\r\\n              <legend><a href=\\\"http://www.openbioinformatics.org/annovar/\\\">Annovar</a> Settings</legend>\\r\\n\\r\\n              <div class=\\\"row\\\">\\r\\n                <div class=\\\"large-12 columns\\\">\\r\\n                  <div class=\\\"row collapse prefix-radius\\\">\\r\\n                    <div class=\\\"large-3 columns\\\">\\r\\n                      <span class=\\\"prefix\\\">Annovar path</span> \\r\\n                    </div>\\r\\n                    <div class=\\\"large-9 columns\\\">\\r\\n                      <input type=\\\"text\\\" placeholder=\\\"e.g. /home/frangipani_server_user/annovar/\\\" name=\\\"annovar-path\\\" required />\\r\\n                      <small class=\\\"error\\\">An Annovar path is required.</small>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n              \\r\\n              <div class=\\\"row\\\" id=\\\"frangipani-annovar-options\\\">\\r\\n                <div class=\\\"large-6 columns\\\">\\r\\n                  <div class=\\\"row\\\">\\r\\n                    <div class=\\\"large-6 large-centered columns\\\">\\r\\n                      <label>Genome builds</label>\\r\\n                      <div class=\\\"row\\\">\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <p>hg19</p>\\r\\n                        </div>\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <div class=\\\"switch small radius\\\">\\r\\n                             <!-- hg19 selected by default -->\\r\\n                            <input id=\\\"hg19RadioSwitch\\\" type=\\\"radio\\\" name=\\\"genome-build\\\" value=\\\"hg19\\\" checked>\\r\\n                            <label for=\\\"hg19RadioSwitch\\\"></label>\\r\\n                          </div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                      <div class=\\\"row\\\">\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <p>hg18</p>\\r\\n                        </div>\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <div class=\\\"switch small radius\\\">\\r\\n                            <input id=\\\"hg18RadioSwitch\\\" type=\\\"radio\\\" name=\\\"genome-build\\\" value=\\\"hg18\\\">\\r\\n                            <label for=\\\"hg18RadioSwitch\\\"></label>\\r\\n                          </div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div> \\r\\n                  <div class=\\\"row\\\">\\r\\n                    <div class=\\\"large-6 large-centered columns\\\" style=\\\"top:20px;\\\">\\r\\n                      <label>Defaul Annotation</label>\\r\\n                       <div class=\\\"row\\\">\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <p>Refgene</p>\\r\\n                        </div>\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <div class=\\\"switch small radius\\\">\\r\\n                           <!-- Refgene selected by default -->\\r\\n                            <input id=\\\"refgeneRadioSwitch\\\" type=\\\"radio\\\" name=\\\"default-annotation\\\" value=\\\"refgene\\\" checked>\\r\\n                            <label for=\\\"refgeneRadioSwitch\\\"></label>\\r\\n                          </div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                      <div class=\\\"row\\\">\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                           <p>UCSC</p>\\r\\n                        </div>\\r\\n                        <div class=\\\"large-6 columns\\\">\\r\\n                          <div class=\\\"switch small radius\\\">\\r\\n                            <input id=\\\"knowngeneRadioSwitch\\\" type=\\\"radio\\\" name=\\\"default-annotation\\\" value=\\\"knowngene\\\">\\r\\n                            <label for=\\\"knowngeneRadioSwitch\\\"></label>\\r\\n                          </div>\\r\\n                        </div>\\r\\n                      </div>\\r\\n                    </div>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n              <div class=\\\"large-6 columns\\\">\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"large-12 large-centered columns\\\">\\r\\n                    <label>Annovar annotations</label>\\r\\n                      <table>\\r\\n                        <tbody>\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.annotations : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                        </tbody>\\r\\n                      </table>\\r\\n                    </div>\\r\\n                  </div>\\r\\n              </div>\\r\\n            </fieldset>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-7 column\\\">\\r\\n                <div class=\\\"row collapse prefix-radius\\\">\\r\\n                  <div class=\\\"large-10 columns\\\">\\r\\n                    <span class=\\\"prefix\\\">Maximum number of variants to output for any query</span>\\r\\n                  </div>\\r\\n                  <div class=\\\"large-2 columns\\\">\\r\\n                    <input type=\\\"text\\\" id=\\\"frangipani-max-records-slider-output\\\" name=\\\"max-query-records\\\" style=\\\"font-weight: bold; text-align: center;\\\" pattern=\\\"[0-9]+\\\" required></span>\\r\\n                    <small class=\\\"error\\\">Please enter a number.</small>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n              <div class=\\\"large-5 columns\\\">\\r\\n                <div class=\\\"range-slider\\\" id= \\\"frangipani-max-records-slider\\\" data-slider data-options=\\\"start: 100; end: 2000; display_selector: #frangipani-max-records-slider-output;\\\" style=\\\"margin-top: 13px;\\\">\\r\\n                  <span class=\\\"range-slider-handle\\\" role=\\\"slider\\\" tabindex=\\\"0\\\"></span>\\r\\n                  <span class=\\\"range-slider-active-segment\\\"></span>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-12 columns\\\">\\r\\n                <div class=\\\"row collapse prefix-radius\\\">\\r\\n                  <div class=\\\"large-3 columns\\\">\\r\\n                    <span class=\\\"prefix\\\">Default footer for reports</span>\\r\\n                  </div>\\r\\n                  <div class=\\\"large-9 columns\\\">\\r\\n                    <input type=\\\"text\\\" id=\\\"frangipani-footer\\\" name=\\\"report-footer\\\" />\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-12 columns\\\">\\r\\n                <div class=\\\"row collapse prefix-radius\\\">\\r\\n                  <div class=\\\"large-3 columns\\\">\\r\\n                    <span class=\\\"prefix\\\">Default disclaimer for reports</span>\\r\\n                  </div>\\r\\n                  <div class=\\\"large-9 columns\\\">\\r\\n                    <textarea rows=11 id=\\\"frangipani-disclaimer\\\" name=\\\"disclaimer\\\"></textarea>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-6 columns\\\"></div>\\r\\n              <div class=\\\"large-4 columns\\\">\\r\\n                <button id=\\\"frangipani-config-form-button\\\" class=\\\"button large round alert\\\" type=\\\"submit\\\"><i class=\\\"fa fa-hand-o-right\\\"></i>&nbsp;Get started!</button>\\r\\n              </div>\\r\\n            </div>\\r\\n\\r\\n          </form>\\r\\n        </div>\\r\\n    </div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],24:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    return \"<div style=\\\"min-height:100%;\\\">\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"small-12 medium-8 large-6 medium-centered large-centered columns\\\">\\r\\n      <form data-abide=\\\"ajax\\\" id=\\\"frangipani-request-login\\\" style=\\\"margin-top:20%\\\">\\r\\n        <fieldset>\\r\\n          <h3 style=\\\"margin-bottom:60px;margin-top:10px;\\\"><i class=\\\"fa fa-chevron-right\\\"></i>&nbspSet Password</h3>\\r\\n          <p style=\\\"margin-bottom:20px;\\\">Update your current password. You will be redirected if the update is successful.</p>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n              <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                <!-- Alert message goes here -->\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-11 columns\\\">\\r\\n                    <p id=\\\"error-display-message\\\"></p>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-1 columns\\\">\\r\\n                    <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" >\\r\\n            <div class=\\\"small-12 large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-3 large-3 columns\\\">\\r\\n                  <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-left radius\\\" title=\\\"Please enter your current password\\\"><span class=\\\"prefix\\\">Password</span></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-9 large-9 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='password' name='password' pattern=\\\"lower\\\" required>\\r\\n                  <small class=\\\"error\\\">Your password must be between 6 and 40 characters</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-3 large-3 columns\\\">\\r\\n                  <span class=\\\"prefix\\\">New Password</span>\\r\\n                </div>\\r\\n                <div class=\\\"small-9 large-9 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='newpassword' name='newpassword' required pattern=\\\"lower\\\" data-notEqual=\\\"password\\\" data-abide-validator=\\\"notEqual\\\">\\r\\n                  <small class=\\\"error\\\">New password must be between 6 and 40 characters long and cannot match your previous one</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 large-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-3 large-3 columns\\\">\\r\\n                  <span class=\\\"prefix\\\">Confirm Password</span>\\r\\n                </div>\\r\\n                <div class=\\\"small-9 large-9 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='confirmPassword' name='confirmPassword' required pattern=\\\"lower\\\" data-equalto=\\\"newpassword\\\">\\r\\n                  <small class=\\\"error\\\">Must match new password</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" style=\\\"margin-top:20px;\\\">\\r\\n            <div class=\\\"small-6 large-3 columns\\\">\\r\\n              <button type=\\\"submit\\\" id=\\\"submit\\\" class=\\\"button radius alert\\\">Update</button>\\r\\n            </div>\\r\\n          </div>\\r\\n        </fieldset>\\r\\n      </form>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],25:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    return \"                    <span>Return to <a href=\\\"/login\\\">login</a></span>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    return \"                    <span>Forgot Password? <a href=\\\"/recover\\\">Recover</a></span>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    return \"                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-2 columns\\\">\\r\\n                    <h4>Or</h4>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-5 columns\\\">\\r\\n                    <hr>\\r\\n                  </div>\\r\\n                </div>\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-12 columns small-centered text-center\\\">\\r\\n                    <a href=\\\"/auth/google\\\" ><img src=\\\"img/signin1.png\\\" class=\\\"small-12 small-centered \\\"style=\\\"width:60%;height:60%\\\"></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div style=\\\"min-height:100%;\\\">\\r\\n  <div class=\\\"row\\\">\\r\\n    <div class=\\\"small-12 medium-8 large-6 medium-centered large-centered columns\\\">\\r\\n      <form data-abide=\\\"ajax\\\" id=\\\"frangipani-request-login\\\" style=\\\"margin-top:20%\\\">\\r\\n        <fieldset>\\r\\n          <h3 style=\\\"margin-bottom:60px;margin-top:10px;\\\"><i class=\\\"fa fa-chevron-right\\\"></i>&nbspSign Up</h3>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n              <div data-alert class=\\\"alert-box radius alert\\\" id=\\\"error-display-box\\\"  style=\\\"display:none\\\">\\r\\n                <!-- Alert message goes here -->\\r\\n                <div class=\\\"row\\\">\\r\\n                  <div class=\\\"small-11 columns\\\">\\r\\n                    <p id=\\\"error-display-message\\\"></p>\\r\\n                  </div>\\r\\n                  <div class=\\\"small-1 columns\\\">\\r\\n                    <a href=\\\"#\\\" class='close-box'><i class=\\\"fi-x size-16\\\" style=\\\"color:#606060\\\"></i></a>\\r\\n                  </div>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" >\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-4 columns\\\">\\r\\n                  <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-left radius\\\" title=\\\"Username Must be a valid email\\\"><span class=\\\"prefix\\\"><i class=\\\"fa fa-envelope-o fa-lg\\\"></i></span></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-8 columns\\\">\\r\\n                  <input type=\\\"email\\\" id='username' name='username' required>\\r\\n                  <small class='error'>Your username must be a valid email</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-4 columns\\\">\\r\\n                  <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-left radius\\\" title=\\\"Passwords must be between 6 and 40 characters long\\\"><span class=\\\"prefix\\\"><i class=\\\"fa fa-key fa-lg\\\"></i></span></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-8 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='password' name='password' required pattern='lower'>\\r\\n                  <small class=\\\"error\\\">Password must be at least 6 characters long</small>\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 columns\\\">\\r\\n              <div class=\\\"row collapse prefix-radius\\\">\\r\\n                <div class=\\\"small-4 columns\\\">\\r\\n                  <span data-tooltip aria-haspopup=\\\"true\\\" class=\\\"has-tip tip-left radius\\\" title=\\\"Please retype your password. Both passwords must match\\\"><span class=\\\"prefix\\\">Confirm&nbsp&nbsp<i class=\\\"fa fa-key fa-lg\\\"></i></span></span>\\r\\n                </div>\\r\\n                <div class=\\\"small-8 columns\\\">\\r\\n                  <input type=\\\"password\\\" id='confirmPassword' name='confirmPassword' required pattern=\\\"lower\\\" data-equalto=\\\"password\\\">\\r\\n                  <small class=\\\"error\\\">Passwords do not match</small>\\r\\n\\r\\n                </div>\\r\\n              </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\" style=\\\"margin-top:20px;\\\">\\r\\n            <div class=\\\"small-3 columns\\\">\\r\\n              <button id=\\\"submit-signup\\\" class=\\\"button radius alert\\\" type='submit'>Login</button>\\r\\n            </div>\\r\\n            <div class=\\\"small-9 columns\\\">\\r\\n                <div class=\\\"small-12 columns\\\" id=\\\"extra-field-1\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.login : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </div>\\r\\n                <div class=\\\"small-12 columns\\\" id=\\\"extra-field-2\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.recover : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"                </div>\\r\\n            </div>\\r\\n          </div>\\r\\n          <div class=\\\"row\\\">\\r\\n            <div class=\\\"small-12 large-12 columns\\\" id=\\\"extra-field-3\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.oauth : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(5, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"            </div>\\r\\n          </div>\\r\\n        </fieldset>\\r\\n      </form>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],26:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"	<tr data-id=\\\"\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n		<td>\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n		<td>\"\n    + alias3(((helper = (helper = helpers.file || (depth0 != null ? depth0.file : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"file\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n		<td>\"\n    + alias3(((helper = (helper = helpers.added || (depth0 != null ? depth0.added : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"added\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n		<td class=\\\"completed\\\">\"\n    + alias3(((helper = (helper = helpers.completed || (depth0 != null ? depth0.completed : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"completed\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n		<td class=\\\"text-center check\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.ready : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(2, data, 0),\"inverse\":this.program(4, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"		</td>\\r\\n	</tr>\\r\\n\";\n},\"2\":function(depth0,helpers,partials,data) {\n    return \"				<i class=\\\"fi-check size-24\\\" style=\\\"color:#66CD00;\\\"</i>\\r\\n\";\n},\"4\":function(depth0,helpers,partials,data) {\n    return \"				<i class=\\\"fa fa-spinner fa-spin\\\" style=\\\"color:#3399FF;font-size:1.5em;\\\"</i>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<!-- add new file -->\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.patients : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\");\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],27:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"				<table class='small-12 medium-12 large-12'>\\r\\n			        <thead>\\r\\n			          	<tr>\\r\\n				          <th>Patient</th>\\r\\n				          <th>File</th>\\r\\n				          <th>Added</th>\\r\\n				          <th>Completed</th>\\r\\n				          <th>Status</th>\\r\\n			        	</tr>\\r\\n			      	</thead>\\r\\n			      	<tbody id=\\\"frangipani-status-row\\\">\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.patients : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(2, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"				   	</tbody>\\r\\n				</table>\\r\\n\";\n},\"2\":function(depth0,helpers,partials,data) {\n    var stack1, helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"						<tr data-id=\\\"\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n							<td>\"\n    + alias3(((helper = (helper = helpers.patient_id || (depth0 != null ? depth0.patient_id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"patient_id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n							<td>\"\n    + alias3(((helper = (helper = helpers.file || (depth0 != null ? depth0.file : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"file\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n							<td>\"\n    + alias3(((helper = (helper = helpers.added || (depth0 != null ? depth0.added : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"added\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n							<td class=\\\"completed\\\">\"\n    + alias3(((helper = (helper = helpers.completed || (depth0 != null ? depth0.completed : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"completed\",\"hash\":{},\"data\":data}) : helper)))\n    + \"</td>\\r\\n							<td class=\\\"text-center check\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.ready : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(3, data, 0),\"inverse\":this.program(5, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"							</td>\\r\\n						</tr>\\r\\n\";\n},\"3\":function(depth0,helpers,partials,data) {\n    return \"									<i class=\\\"fi-check size-24\\\" style=\\\"color:#66CD00;\\\"</i>\\r\\n\";\n},\"5\":function(depth0,helpers,partials,data) {\n    return \"									<i class=\\\"fa fa-spinner fa-spin\\\" style=\\\"color:#3399FF;font-size:1.5em;\\\"</i>\\r\\n\";\n},\"7\":function(depth0,helpers,partials,data) {\n    return \"				<div data-alert class=\\\"alert-box radius secondary\\\" id=\\\"error-display-box\\\">\\r\\n			      <!-- Alert message goes here -->\\r\\n			      <div class=\\\"row\\\">\\r\\n			          <div class=\\\"small-11 columns\\\">\\r\\n			              <p id=\\\"error-display-message\\\">There does not appear to be anyhting here</p>\\r\\n			          </div>\\r\\n			        </div>\\r\\n			    </div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1;\n\n  return \"<div class=\\\"row\\\">\\r\\n	<div class=\\\"large-12 columns\\\">\\r\\n		<div class=\\\"row\\\">\\r\\n			<div class=\\\"large-12 columns\\\">\\r\\n				<h2>Recent Uploads</h2>\\r\\n				<h5 class=\\\"subheader\\\">Displaying All Uploads</h5>\\r\\n				<p>Information on recent uploads, including the Patient Id, the original file name and the useability status. If a patient has been completely uploaded, annotated and is available for use in searching, a checkmark will be displayed. Otherwise the spinning icon denotes the file is not currently ready to use.</p>\\r\\n			</div>\\r\\n		</div>\\r\\n		<div class=\\\"row\\\">\\r\\n			<div class= large-12 columns\\\">\\r\\n\"\n    + ((stack1 = helpers['if'].call(depth0,(depth0 != null ? depth0.patients : depth0),{\"name\":\"if\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.program(7, data, 0),\"data\":data})) != null ? stack1 : \"\")\n    + \"			</div>\\r\\n		</div>\\r\\n	</div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],28:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var helper, alias1=helpers.helperMissing, alias2=\"function\", alias3=this.escapeExpression;\n\n  return \"\\r\\n<div class=\\\"row\\\">\\r\\n  <hr>\\r\\n  <div class=\\\"small-12 medium-12 columns\\\" id=fileNum\"\n    + alias3(((helper = (helper = helpers.Id || (depth0 != null ? depth0.Id : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"Id\",\"hash\":{},\"data\":data}) : helper)))\n    + \">\\r\\n\\r\\n    <div class=\\\"row\\\">\\r\\n      <a href=\\\"#\\\" class=\\\"button submit-button\\\" style=\\\"display:none\\\"></a>\\r\\n      <div class=\\\"small-10 medium-10 columns\\\">\\r\\n        <p id='file-to-upload'>\"\n    + alias3(((helper = (helper = helpers['file-name'] || (depth0 != null ? depth0['file-name'] : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"file-name\",\"hash\":{},\"data\":data}) : helper)))\n    + \"&nbsp<i>\"\n    + alias3(((helper = (helper = helpers.size || (depth0 != null ? depth0.size : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{\"name\":\"size\",\"hash\":{},\"data\":data}) : helper)))\n    + \"kb</i></p>\\r\\n      </div>\\r\\n      <div class=\\\"small-2 medium-2 columns right\\\">\\r\\n        <a href=\\\"#\\\" class=\\\"button alert tiny right radius cancel-button\\\">cancel</a>\\r\\n      </div>\\r\\n    </div>\\r\\n    <div class='progress'>\\r\\n      <span class='meter' style='width:0%'></span>\\r\\n    </div>\\r\\n  </div>\\r\\n</div>\\r\\n\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],29:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"1\":function(depth0,helpers,partials,data) {\n    return \"		<div class=\\\"row\\\">\\r\\n			<div class=\\\"small-12 large-12 columns new-patients\\\">\\r\\n				<div class=\\\"small-2 large-3 columns data-fieled\\\">\\r\\n					<input class='patient_id' type='text' value=\"\n    + this.escapeExpression(this.lambda(depth0, depth0))\n    + \" placeholder=\\\"NA001\\\" name=\\\"patient_id\\\" required>\\r\\n					<small class=\\\"error\\\" style=\\\"display:none;\\\">Patient Identifier Already In use</small>\\r\\n				</div>\\r\\n				<div class=\\\"small-2 large-3 columns data-field\\\">\\r\\n					<input name=\\\"patient_alias\\\" type='text'>\\r\\n				</div>\\r\\n				<div class=\\\"small-2 large-2 columns data-field\\\">\\r\\n					<input name=\\\"patient_phenotype\\\" type='text'>\\r\\n				</div>\\r\\n				<div class=\\\"small-2 large-1 columns data-field\\\">\\r\\n					<input class=\\\"age\\\" name=\\\"age\\\" type='text'>\\r\\n					<small class=\\\"error\\\" style=\\\"display:none;\\\">Must Be A number</small>\\r\\n				</div>\\r\\n				<div class=\\\"small-4 large-3 columns data-field\\\">\\r\\n			      <div class=\\\"small-12 medium-12 columns right\\\">  \\r\\n			        <input name=\\\"sex\\\" style=\\\"display:none\\\" type=\\\"text\\\" value=\\\"\\\">\\r\\n			        <ul class=\\\"button-group even-3 radius sex-switch\\\">\\r\\n			          <li><a href=\\\"#\\\" class=\\\"button secondary tiny\\\">M</a></li>\\r\\n			          <li><a href=\\\"#\\\" class=\\\"button secondary tiny\\\">F</a></li>\\r\\n			          <li><a href=\\\"#\\\" class=\\\"button tiny\\\">N/A</a></li>\\r\\n			        </ul>\\r\\n			      </div>\\r\\n			    </div>\\r\\n			</div>\\r\\n		</div>\\r\\n\";\n},\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    var stack1, helper;\n\n  return \"<div class=\\\"row\\\">\\r\\n	<div class=\\\"small-12 large-12 columns new-file fileNum\"\n    + this.escapeExpression(((helper = (helper = helpers.Id || (depth0 != null ? depth0.Id : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === \"function\" ? helper.call(depth0,{\"name\":\"Id\",\"hash\":{},\"data\":data}) : helper)))\n    + \"\\\">\\r\\n\"\n    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.patient_ids : depth0),{\"name\":\"each\",\"hash\":{},\"fn\":this.program(1, data, 0),\"inverse\":this.noop,\"data\":data})) != null ? stack1 : \"\")\n    + \"		<hr>\\r\\n	</div>\\r\\n</div>\\r\\n\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}],30:[function(require,module,exports){
// hbsfy compiled Handlebars template
var HandlebarsCompiler = require('hbsfy/runtime');
module.exports = HandlebarsCompiler.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
    return "// hbsfy compiled Handlebars template\nvar HandlebarsCompiler = require('hbsfy/runtime');\nmodule.exports = HandlebarsCompiler.template({\"compiler\":[6,\">= 2.0.0-beta.1\"],\"main\":function(depth0,helpers,partials,data) {\n    return \"<div class=\\\"row\\\">  \\r\\n  <div class=\\\"large-12 columns\\\" style=\\\"top:15px;\\\">\\r\\n    <h2><i class=\\\"fi-torso size-28\\\"></i>&nbspAdd a new patient</h2>\\r\\n  </div>\\r\\n</div>\\r\\n<div class=\\\"row\\\">\\r\\n  <div class=\\\"large-12 columns\\\">\\r\\n    <h6 class=\\\"subheader spacer\\\">Add a new file to get started!</h6>\\r\\n    <p>Files you want to upload must be in the appropriate <a href=\\\"http://www.1000genomes.org/wiki/analysis/variant%20call%20format/vcf-variant-call-format-version-41\\\" target=\\\"_blank\\\">VCF format</a>. Each file can have any number of subjects contained within it, their ID’s will automatically be extracted and the number of subjects will be determined. Additionally you can add more than one vcf file, simply click the “Add File” button. If you have several files and you would like to only remove one of them, scroll down to the bottom of the screen and click “Cancel” located next to the file of choice. This will remove the file as well as all of its entries. If you Want to remove everything hit the big “Cancel” button at the bottom of the page.</p>\\r\\n\\r\\n    <p>Once you have all of your files selected, click “Submit”. Each files progress will be monitored in the upload bar. Once they are uploaded, give the file some time as it needs to be annotated. Check out the upload status bar to see if it is available for viewing yet!</p>\\r\\n    <h6 class=\\\"subheader spacer\\\"><i>NOTICE: Leaving this page prior to upload completion will cancel the upload and the file will not be processed</i></h6>\\r\\n  </div>\\r\\n  <div class=\\\"small-12 large-12 columns\\\">\\r\\n    <form id=\\\"jquery-new-patient-form\\\" data-abide>\\r\\n      <div class=\\\"row\\\">\\r\\n        <div class=\\\"small-12 large-12 columns\\\">\\r\\n          <fieldset style=\\\"display:none\\\" id=\\\"info-fields\\\">\\r\\n            <legend>Patient Information</legend>\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"small-12 large-12 columns\\\">\\r\\n                <div class=\\\"small-2 large-3 columns\\\" style=\\\"text-align:center;\\\">\\r\\n                  <h6>Patient Id</h6>\\r\\n                </div>\\r\\n                <div class=\\\"small-2 large-3 columns\\\" style=\\\"text-align:center;\\\">\\r\\n                  <h6>Patient Alias</h6>\\r\\n                </div>\\r\\n                <div class=\\\"small-2 large-2 columns\\\" style=\\\"text-align:center;\\\">\\r\\n                  <h6>Phenotype</h6>\\r\\n                </div>\\r\\n                <div class=\\\"small-2 large-1 columns\\\" style=\\\"text-align:center;\\\">\\r\\n                  <h6>Age</h6>\\r\\n                </div>\\r\\n                <div class=\\\"small-4 large-3 columns\\\" style=\\\"text-align:center;\\\">\\r\\n                  <h6 style=\\\"text-align:center;\\\">Sex</h6>\\r\\n                </div>\\r\\n                <hr>\\r\\n              </div>\\r\\n            </div>\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"small-12 large-12 columns\\\" id=\\\"patient_information\\\">\\r\\n              </div>\\r\\n            </div>\\r\\n          </fieldset>\\r\\n          <fieldset style=\\\"display:none;\\\" id=\\\"upload-fields\\\">\\r\\n            <legend>Upload Files</legend>\\r\\n            <div class=\\\"row\\\">\\r\\n              <div class=\\\"large-12 columns\\\" id=\\\"patient_vcf\\\">\\r\\n              </div>\\r\\n            </div>\\r\\n          </fieldset>\\r\\n        </div>\\r\\n      </div<\\r\\n      <div class=\\\"row\\\">\\r\\n        <div class=\\\"small-6 large-4 columns left\\\">\\r\\n          <input id=\\\"fileselect\\\" type=\\\"file\\\" name=\\\"files[]\\\" style=\\\"display:none\\\" multiple></input>\\r\\n          <a href=\\\"#\\\" class=\\\"button alert round large-12\\\" id=\\\"upload-button\\\"><i class=\\\"fi-plus size-16\\\"></i>&nbsp&nbspAdd File</a></li>\\r\\n        </div>\\r\\n        <div class=\\\"small-6 large-4 columns right\\\">\\r\\n          <a href='/statuspage' class=\\\"small-12 large-12 button round alert\\\" id=\\\"go-to-status\\\" style=\\\"display:none;\\\">Check Status</a>\\r\\n          <ul class=\\\"button-group even-2 round\\\">\\r\\n            <li><a href=\\\"#\\\" class=\\\"button alert\\\" id=\\\"cancel-all-button\\\"><i class=\\\"fi-x size-16\\\"></i>&nbsp&nbspCancel</a></li>\\r\\n            <li><a href=\\\"#\\\" class=\\\"button alert\\\" id=\\\"submit-all-button\\\"><i class=\\\"fi-upload size-16\\\"></i>&nbsp&nbspSubmit</a></li>\\r\\n          </ul>\\r\\n        </div>     \\r\\n      </div>\\r\\n    </form>\\r\\n  </div>\\r\\n</div>\";\n},\"useData\":true});\n";
},"useData":true});

},{"hbsfy/runtime":8}]},{},[10]);
