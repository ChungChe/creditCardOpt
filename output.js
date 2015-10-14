// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB;
// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = function print(x) {
    process['stdout'].write(x + '\n');
  };
  if (!Module['printErr']) Module['printErr'] = function printErr(x) {
    process['stderr'].write(x + '\n');
  };

  var nodeFS = require('fs');
  var nodePath = require('path');

  Module['read'] = function read(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) { return Module['read'](filename, true) };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.log(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret; return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}


Module['Runtime'] = Runtime;



//========================================
// Runtime essentials
//========================================

var __THREW__ = 0; // Used in checking for thrown exceptions.

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try {
      func = eval('_' + ident); // explicit lookup
    } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }
  var JSsource = {};
  for (var fun in JSfuncs) {
    if (JSfuncs.hasOwnProperty(fun)) {
      // Elements of toCsource are arrays of three items:
      // the code, and the return value
      JSsource[fun] = parseJSFunc(JSfuncs[fun]);
    }
  }

  
  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=' + convertCode.returnValue + ';';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["cwrap"] = cwrap;
Module["ccall"] = ccall;


function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module['allocate'] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module['getMemory'] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module['Pointer_stringify'] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module['AsciiToString'] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module['stringToAscii'] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module['UTF8ArrayToString'] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8, ptr);
}
Module['UTF8ToString'] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module['stringToUTF8Array'] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
Module['stringToUTF8'] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module['lengthBytesUTF8'] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}
Module['UTF16ToString'] = UTF16ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}
Module['stringToUTF16'] = stringToUTF16;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}
Module['lengthBytesUTF16'] = lengthBytesUTF16;

function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
Module['UTF32ToString'] = UTF32ToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}
Module['stringToUTF32'] = stringToUTF32;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}
Module['lengthBytesUTF32'] = lengthBytesUTF32;

function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  var i = 3;
  // params, etc.
  var basicTypes = {
    'v': 'void',
    'b': 'bool',
    'c': 'char',
    's': 'short',
    'i': 'int',
    'l': 'long',
    'f': 'float',
    'd': 'double',
    'w': 'wchar_t',
    'a': 'signed char',
    'h': 'unsigned char',
    't': 'unsigned short',
    'j': 'unsigned int',
    'm': 'unsigned long',
    'x': 'long long',
    'y': 'unsigned long long',
    'z': '...'
  };
  var subs = [];
  var first = true;
  function dump(x) {
    //return;
    if (x) Module.print(x);
    Module.print(func);
    var pre = '';
    for (var a = 0; a < i; a++) pre += ' ';
    Module.print (pre + '^');
  }
  function parseNested() {
    i++;
    if (func[i] === 'K') i++; // ignore const
    var parts = [];
    while (func[i] !== 'E') {
      if (func[i] === 'S') { // substitution
        i++;
        var next = func.indexOf('_', i);
        var num = func.substring(i, next) || 0;
        parts.push(subs[num] || '?');
        i = next+1;
        continue;
      }
      if (func[i] === 'C') { // constructor
        parts.push(parts[parts.length-1]);
        i += 2;
        continue;
      }
      var size = parseInt(func.substr(i));
      var pre = size.toString().length;
      if (!size || !pre) { i--; break; } // counter i++ below us
      var curr = func.substr(i + pre, size);
      parts.push(curr);
      subs.push(curr);
      i += pre + size;
    }
    i++; // skip E
    return parts;
  }
  function parse(rawList, limit, allowVoid) { // main parser
    limit = limit || Infinity;
    var ret = '', list = [];
    function flushList() {
      return '(' + list.join(', ') + ')';
    }
    var name;
    if (func[i] === 'N') {
      // namespaced N-E
      name = parseNested().join('::');
      limit--;
      if (limit === 0) return rawList ? [name] : name;
    } else {
      // not namespaced
      if (func[i] === 'K' || (first && func[i] === 'L')) i++; // ignore const and first 'L'
      var size = parseInt(func.substr(i));
      if (size) {
        var pre = size.toString().length;
        name = func.substr(i + pre, size);
        i += pre + size;
      }
    }
    first = false;
    if (func[i] === 'I') {
      i++;
      var iList = parse(true);
      var iRet = parse(true, 1, true);
      ret += iRet[0] + ' ' + name + '<' + iList.join(', ') + '>';
    } else {
      ret = name;
    }
    paramLoop: while (i < func.length && limit-- > 0) {
      //dump('paramLoop');
      var c = func[i++];
      if (c in basicTypes) {
        list.push(basicTypes[c]);
      } else {
        switch (c) {
          case 'P': list.push(parse(true, 1, true)[0] + '*'); break; // pointer
          case 'R': list.push(parse(true, 1, true)[0] + '&'); break; // reference
          case 'L': { // literal
            i++; // skip basic type
            var end = func.indexOf('E', i);
            var size = end - i;
            list.push(func.substr(i, size));
            i += size + 2; // size + 'EE'
            break;
          }
          case 'A': { // array
            var size = parseInt(func.substr(i));
            i += size.toString().length;
            if (func[i] !== '_') throw '?';
            i++; // skip _
            list.push(parse(true, 1, true)[0] + ' [' + size + ']');
            break;
          }
          case 'E': break paramLoop;
          default: ret += '?' + c; break paramLoop;
        }
      }
    }
    if (!allowVoid && list.length === 1 && list[0] === 'void') list = []; // avoid (void)
    if (rawList) {
      if (ret) {
        list.push(ret + '?');
      }
      return list;
    } else {
      return ret + flushList();
    }
  }
  var parsed = func;
  try {
    // Special-case the entry point, since its name differs from other name mangling.
    if (func == 'Object._main' || func == '_main') {
      return 'main()';
    }
    if (typeof func === 'number') func = Pointer_stringify(func);
    if (func[0] !== '_') return func;
    if (func[1] !== '_') return func; // C function
    if (func[2] !== 'Z') return func;
    switch (func[3]) {
      case 'n': return 'operator new()';
      case 'd': return 'operator delete()';
    }
    parsed = parse();
  } catch(e) {
    parsed += '?';
  }
  if (parsed.indexOf('?') >= 0 && !hasLibcxxabi) {
    Runtime.warnOnce('warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  }
  return parsed;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module['stackTrace'] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function enlargeMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.');
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec (and given that TOTAL_STACK=' + TOTAL_STACK + ')');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');

var buffer;
buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);

// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module['addOnPreRun'] = Module.addOnPreRun = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module['addOnInit'] = Module.addOnInit = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module['addOnPreMain'] = Module.addOnPreMain = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module['addOnExit'] = Module.addOnExit = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module['addOnPostRun'] = Module.addOnPostRun = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module['intArrayFromString'] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module['writeAsciiToMemory'] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module['removeRunDependency'] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 6416;
  /* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_embind_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });
  

/* memory initializer */ allocate([0,0,0,0,48,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,0,0,0,0,49,51,67,114,101,100,105,99,116,67,97,114,100,72,78,0,112,19,0,0,32,0,0,0,176,2,0,0,0,0,0,0,0,0,0,0,104,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,0,0,0,0,49,51,67,114,101,100,105,99,116,67,97,114,100,89,83,0,112,19,0,0,88,0,0,0,176,2,0,0,0,0,0,0,0,0,0,0,168,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,0,0,0,0,49,56,67,114,101,100,105,99,116,67,97,114,100,72,78,73,67,97,115,104,0,0,0,0,112,19,0,0,144,0,0,0,176,2,0,0,0,0,0,0,66,105,108,108,84,121,112,101,0,0,0,0,0,0,0,0,110,111,114,109,97,108,0,0,105,99,97,115,104,0,0,0,110,101,116,119,111,114,107,0,111,105,108,0,0,0,0,0,66,105,108,108,0,0,0,0,103,101,116,65,109,111,117,110,116,0,0,0,0,0,0,0,103,101,116,84,121,112,101,0,105,110,102,111,0,0,0,0,118,101,99,116,111,114,66,105,108,108,0,0,0,0,0,0,67,114,101,100,105,99,116,67,97,114,100,66,97,115,101,0,103,101,116,68,105,115,99,111,117,110,116,0,0,0,0,0,97,100,100,80,114,101,65,115,115,105,103,110,66,105,108,108,0,0,0,0,0,0,0,0,97,100,100,65,115,115,105,103,110,66,105,108,108,0,0,0,99,108,101,97,114,65,115,115,105,103,110,66,105,108,108,0,103,101,116,68,105,115,67,111,117,110,116,70,111,114,67,111,109,109,105,116,0,0,0,0,99,111,109,109,105,116,67,117,114,114,101,110,116,65,115,115,105,103,110,0,0,0,0,0,100,117,109,112,66,101,115,116,65,115,115,105,103,110,0,0,103,101,116,66,101,115,116,65,115,115,105,103,110,66,105,108,108,0,0,0,0,0,0,0,67,114,101,100,105,99,116,67,97,114,100,72,78,0,0,0,103,101,116,68,105,115,67,111,117,110,116,0,0,0,0,0,67,114,101,100,105,99,116,67,97,114,100,89,83,0,0,0,67,114,101,100,105,99,116,67,97,114,100,72,78,73,67,97,115,104,0,0,0,0,0,0,67,114,101,100,105,99,116,67,97,114,100,77,103,114,0,0,97,100,100,66,105,108,108,0,97,100,100,67,97,114,100,0,97,115,115,105,103,110,67,97,114,100,0,0,0,0,0,0,103,101,116,77,97,120,68,105,115,67,111,117,110,116,0,0,48,0,0,0,0,0,0,0,101,109,98,105,110,100,46,99,112,112,0,0,0,0,0,0,109,97,120,32,100,105,115,67,111,117,110,116,32,61,32,37,100,10,0,0,0,0,0,0,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,61,10,0,0,0,0,0,72,19,0,0,240,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,176,2,0,0,10,0,0,0,11,0,0,0,12,0,0,0,0,0,0,0,49,53,67,114,101,100,105,99,116,67,97,114,100,66,97,115,101,0,0,0,0,0,0,0,105,105,105,0,0,0,0,0,144,18,0,0,24,3,0,0,48,20,0,0,40,3,0,0,0,0,0,0,64,3,0,0,80,49,52,67,114,101,100,105,99,116,67,97,114,100,77,103,114,0,0,0,0,0,0,0,72,19,0,0,72,3,0,0,49,52,67,114,101,100,105,99,116,67,97,114,100,77,103,114,0,0,0,0,0,0,0,0,118,105,105,0,0,0,0,0,16,18,0,0,24,3,0,0,118,105,105,105,0,0,0,0,16,18,0,0,24,3,0,0,136,3,0,0,0,0,0,0,48,20,0,0,152,3,0,0,0,0,0,0,176,2,0,0,80,49,53,67,114,101,100,105,99,116,67,97,114,100,66,97,115,101,0,0,0,0,0,0,118,105,105,105,105,0,0,0,16,18,0,0,24,3,0,0,200,3,0,0,136,3,0,0,48,20,0,0,216,3,0,0,0,0,0,0,224,3,0,0,80,52,66,105,108,108,0,0,72,19,0,0,232,3,0,0,52,66,105,108,108,0,0,0,105,105,0,0,0,0,0,0,24,3,0,0,0,0,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,32,4,0,0,1,0,0,0,64,3,0,0,80,75,49,52,67,114,101,100,105,99,116,67,97,114,100,77,103,114,0,0,0,0,0,0,105,105,105,0,0,0,0,0,72,4,0,0,88,4,0,0,48,20,0,0,224,4,0,0,0,0,0,0,168,0,0,0,208,19,0,0,112,4,0,0,0,0,0,0,1,0,0,0,176,4,0,0,0,0,0,0,78,83,116,51,95,95,49,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,0,72,19,0,0,184,4,0,0,78,83,116,51,95,95,49,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,0,0,80,49,56,67,114,101,100,105,99,116,67,97,114,100,72,78,73,67,97,115,104,0,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,40,5,0,0,1,0,0,0,168,0,0,0,80,75,49,56,67,114,101,100,105,99,116,67,97,114,100,72,78,73,67,97,115,104,0,0,105,105,105,0,0,0,0,0,144,18,0,0,80,5,0,0,48,20,0,0,96,5,0,0,0,0,0,0,104,0,0,0,80,49,51,67,114,101,100,105,99,116,67,97,114,100,89,83,0,0,0,0,0,0,0,0,105,105,105,0,0,0,0,0,80,5,0,0,88,4,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,184,5,0,0,1,0,0,0,104,0,0,0,80,75,49,51,67,114,101,100,105,99,116,67,97,114,100,89,83,0,0,0,0,0,0,0,105,105,105,0,0,0,0,0,144,18,0,0,224,5,0,0,48,20,0,0,240,5,0,0,0,0,0,0,48,0,0,0,80,49,51,67,114,101,100,105,99,116,67,97,114,100,72,78,0,0,0,0,0,0,0,0,105,105,105,0,0,0,0,0,224,5,0,0,88,4,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,72,6,0,0,1,0,0,0,48,0,0,0,80,75,49,51,67,114,101,100,105,99,116,67,97,114,100,72,78,0,0,0,0,0,0,0,118,105,105,105,0,0,0,0,16,18,0,0,136,3,0,0,120,6,0,0,0,0,0,0,208,19,0,0,144,6,0,0,0,0,0,0,1,0,0,0,192,6,0,0,0,0,0,0,78,83,116,51,95,95,49,54,118,101,99,116,111,114,73,80,52,66,105,108,108,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,50,95,69,69,69,69,0,0,0,0,0,0,208,19,0,0,216,6,0,0,0,0,0,0,1,0,0,0,16,7,0,0,0,0,0,0,78,83,116,51,95,95,49,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,80,52,66,105,108,108,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,50,95,69,69,69,69,0,0,0,0,0,0,72,19,0,0,24,7,0,0,78,83,116,51,95,95,49,50,48,95,95,118,101,99,116,111,114,95,98,97,115,101,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,0,0,0,99,114,101,100,105,99,116,32,99,97,114,100,32,61,32,37,115,10,0,0,0,0,0,0,100,105,115,67,111,117,110,116,32,61,32,37,100,10,0,0,144,18,0,0,136,3,0,0,118,105,105,0,0,0,0,0,16,18,0,0,136,3,0,0,118,105,105,105,0,0,0,0,16,18,0,0,136,3,0,0,200,3,0,0,0,0,0,0,105,105,105,0,0,0,0,0,105,105,105,105,0,0,0,0,136,3,0,0,88,4,0,0,144,18,0,0,0,0,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,216,7,0,0,1,0,0,0,176,2,0,0,80,75,49,53,67,114,101,100,105,99,116,67,97,114,100,66,97,115,101,0,0,0,0,0,112,117,115,104,95,98,97,99,107,0,0,0,0,0,0,0,114,101,115,105,122,101,0,0,115,105,122,101,0,0,0,0,103,101,116,0,0,0,0,0,115,101,116,0,0,0,0,0,105,105,105,105,105,0,0,0,48,18,0,0,120,6,0,0,160,18,0,0,200,3,0,0,105,105,105,105,0,0,0,0,80,8,0,0,120,6,0,0,160,18,0,0,0,0,0,0,72,19,0,0,88,8,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,0,0,0,0,0,105,105,105,0,0,0,0,0,160,18,0,0,128,8,0,0,48,20,0,0,144,8,0,0,1,0,0,0,120,6,0,0,80,75,78,83,116,51,95,95,49,54,118,101,99,116,111,114,73,80,52,66,105,108,108,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,50,95,69,69,69,69,0,0,0,0,118,105,105,105,105,0,0,0,16,18,0,0,216,8,0,0,160,18,0,0,200,3,0,0,48,20,0,0,232,8,0,0,0,0,0,0,120,6,0,0,80,78,83,116,51,95,95,49,54,118,101,99,116,111,114,73,80,52,66,105,108,108,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,50,95,69,69,69,69,0,0,0,0,0,118,105,105,105,0,0,0,0,16,18,0,0,216,8,0,0,200,3,0,0,0,0,0,0,105,105,0,0,0,0,0,0,216,8,0,0,0,0,0,0,118,105,0,0,0,0,0,0,105,105,0,0,0,0,0,0,118,105,105,0,0,0,0,0,16,18,0,0,200,3,0,0,121,101,97,114,32,61,32,37,100,44,32,109,111,110,116,104,32,61,32,37,100,44,32,100,97,121,32,61,32,37,100,44,32,97,109,111,117,110,116,32,61,32,37,100,44,32,116,121,112,101,32,61,32,37,100,44,32,99,111,109,109,101,110,116,32,61,32,37,115,10,0,0,105,105,105,0,0,0,0,0,184,9,0,0,200,3,0,0,240,18,0,0,192,9,0,0,56,66,105,108,108,84,121,112,101,0,0,0,0,0,0,0,105,105,105,0,0,0,0,0,144,18,0,0,200,3,0,0,105,105,105,105,105,105,105,105,0,0,0,0,0,0,0,0,200,3,0,0,144,18,0,0,144,18,0,0,144,18,0,0,144,18,0,0,184,9,0,0,88,4,0,0,0,0,0,0,118,105,0,0,0,0,0,0,118,0,0,0,0,0,0,0,105,105,0,0,0,0,0,0,48,20,0,0,56,10,0,0,1,0,0,0,224,3,0,0,80,75,52,66,105,108,108,0,118,111,105,100,0,0,0,0,98,111,111,108,0,0,0,0,99,104,97,114,0,0,0,0,115,105,103,110,101,100,32,99,104,97,114,0,0,0,0,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,0,0,115,104,111,114,116,0,0,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,0,105,110,116,0,0,0,0,0,117,110,115,105,103,110,101,100,32,105,110,116,0,0,0,0,108,111,110,103,0,0,0,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,0,0,102,108,111,97,116,0,0,0,100,111,117,98,108,101,0,0,115,116,100,58,58,115,116,114,105,110,103,0,0,0,0,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,0,0,0,0,0,0,0,115,116,100,58,58,119,115,116,114,105,110,103,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,0,0,0,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,0,0,0,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,0,0,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,0,0,0,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,0,0,0,0,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,0,0,0,72,19,0,0,200,13,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,0,72,19,0,0,240,13,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,0,72,19,0,0,24,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,0,72,19,0,0,64,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,0,72,19,0,0,104,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,0,72,19,0,0,144,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,0,72,19,0,0,184,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,0,72,19,0,0,224,14,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,0,72,19,0,0,8,15,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,0,72,19,0,0,48,15,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,0,72,19,0,0,88,15,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,0,72,19,0,0,128,15,0,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,0,208,19,0,0,184,15,0,0,0,0,0,0,1,0,0,0,176,4,0,0,0,0,0,0,78,83,116,51,95,95,49,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,0,208,19,0,0,16,16,0,0,0,0,0,0,1,0,0,0,176,4,0,0,0,0,0,0,78,83,116,51,95,95,49,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,0,0,0,0,0,0,0,0,0,13,0,0,0,0,0,0,0,0,0,0,0,136,16,0,0,14,0,0,0,15,0,0,0,16,0,0,0,0,0,0,0,83,116,57,98,97,100,95,97,108,108,111,99,0,0,0,0,112,19,0,0,120,16,0,0,176,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,83,116,57,101,120,99,101,112,116,105,111,110,0,0,0,0,72,19,0,0,160,16,0,0,83,116,57,116,121,112,101,95,105,110,102,111,0,0,0,0,72,19,0,0,184,16,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,0,0,0,0,112,19,0,0,208,16,0,0,200,16,0,0,0,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,0,0,0,112,19,0,0,8,17,0,0,248,16,0,0,0,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,0,0,0,112,19,0,0,104,17,0,0,248,16,0,0,0,0,0,0,112,19,0,0,64,17,0,0,144,17,0,0,0,0,0,0,0,0,0,0,248,17,0,0,17,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,21,0,0,0,0,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,112,19,0,0,208,17,0,0,248,16,0,0,0,0,0,0,118,0,0,0,0,0,0,0,184,17,0,0,8,18,0,0,68,110,0,0,0,0,0,0,184,17,0,0,24,18,0,0,98,0,0,0,0,0,0,0,184,17,0,0,40,18,0,0,99,0,0,0,0,0,0,0,184,17,0,0,56,18,0,0,104,0,0,0,0,0,0,0,184,17,0,0,72,18,0,0,97,0,0,0,0,0,0,0,184,17,0,0,88,18,0,0,115,0,0,0,0,0,0,0,184,17,0,0,104,18,0,0,116,0,0,0,0,0,0,0,184,17,0,0,120,18,0,0,105,0,0,0,0,0,0,0,184,17,0,0,136,18,0,0,106,0,0,0,0,0,0,0,184,17,0,0,152,18,0,0,108,0,0,0,0,0,0,0,184,17,0,0,168,18,0,0,109,0,0,0,0,0,0,0,184,17,0,0,184,18,0,0,102,0,0,0,0,0,0,0,184,17,0,0,200,18,0,0,100,0,0,0,0,0,0,0,184,17,0,0,216,18,0,0,0,0,0,0,48,19,0,0,17,0,0,0,22,0,0,0,19,0,0,0,20,0,0,0,23,0,0,0,0,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,101,110,117,109,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,0,0,0,0,112,19,0,0,8,19,0,0,248,16,0,0,0,0,0,0,0,0,0,0,48,17,0,0,17,0,0,0,24,0,0,0,19,0,0,0,20,0,0,0,25,0,0,0,26,0,0,0,27,0,0,0,28,0,0,0,0,0,0,0,184,19,0,0,17,0,0,0,29,0,0,0,19,0,0,0,20,0,0,0,25,0,0,0,30,0,0,0,31,0,0,0,32,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,0,0,0,112,19,0,0,144,19,0,0,48,17,0,0,0,0,0,0,0,0,0,0,24,20,0,0,17,0,0,0,33,0,0,0,19,0,0,0,20,0,0,0,25,0,0,0,34,0,0,0,35,0,0,0,36,0,0,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,0,0,112,19,0,0,240,19,0,0,48,17,0,0,0,0,0,0,0,0,0,0,160,17,0,0,17,0,0,0,37,0,0,0,19,0,0,0,20,0,0,0,38,0,0,0,0,0,0,0,33,34,118,101,99,116,111,114,32,108,101,110,103,116,104,95,101,114,114,111,114,34,0,0,67,58,92,80,114,111,103,114,97,109,32,70,105,108,101,115,92,69,109,115,99,114,105,112,116,101,110,92,101,109,115,99,114,105,112,116,101,110,92,49,46,51,52,46,49,92,115,121,115,116,101,109,92,105,110,99,108,117,100,101,92,108,105,98,99,120,120,92,118,101,99,116,111,114,0,0,0,0,0,0,95,95,116,104,114,111,119,95,108,101,110,103,116,104,95,101,114,114,111,114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,0,0,0,0,0,0,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,116,104,114,101,119,32,97,110,32,101,120,99,101,112,116,105,111,110,0,0,0,0,0,0,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,0,0,0,0,0,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,0,0,0,33,34,98,97,115,105,99,95,115,116,114,105,110,103,32,108,101,110,103,116,104,95,101,114,114,111,114,34,0,0,0,0,67,58,92,80,114,111,103,114,97,109,32,70,105,108,101,115,92,69,109,115,99,114,105,112,116,101,110,92,101,109,115,99,114,105,112,116,101,110,92,49,46,51,52,46,49,92,115,121,115,116,101,109,92,105,110,99,108,117,100,101,92,108,105,98,99,120,120,92,115,116,114,105,110,103,0,0,0,0,0,0,0,23,0,0,0,0,0,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,0,0,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,0,0,0,0,0,0,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,0,0,116,101,114,109,105,110,97,116,105,110,103,0,0,0,0,0,117,110,99,97,117,103,104,116,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }

  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  
  
  var ___errno_state=0;function ___setErrNo(value) {
      // For convenient setting and returning of errno.
      HEAP32[((___errno_state)>>2)]=value;
      return value;
    }function ___errno_location() {
      return ___errno_state;
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        if (info.refcount === 0) {
          if (info.destructor) {
            Runtime.dynCall('vi', info.destructor, [ptr]);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      EXCEPTIONS.clearRef(EXCEPTIONS.deAdjust(ptr)); // exception refcount should be cleared, but don't free it
      throw ptr;
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((asm["setTempRet0"](0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((asm["setTempRet0"](0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((asm["setTempRet0"](typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((asm["setTempRet0"](throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr;
    }

   
  Module["_memset"] = _memset;

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  var _emscripten_landingpad=true;

  function _abort() {
      Module['abort']();
    }

  
  function _free() {
  }
  Module["_free"] = _free;
  
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  Module["_malloc"] = _malloc;
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              function getTAElement(ta, index) {
                  return ta[index];
              }
              function getStringElement(string, index) {
                  return string.charCodeAt(index);
              }
              var getElement;
              if (value instanceof Uint8Array) {
                  getElement = getTAElement;
              } else if (value instanceof Int8Array) {
                  getElement = getTAElement;
              } else if (typeof value === 'string') {
                  getElement = getStringElement;
              } else {
                  throwBindingError('Cannot pass non-string to std::string');
              }
  
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length);
              HEAPU32[ptr >> 2] = length;
              for (var i = 0; i < length; ++i) {
                  var charCode = getElement(value, i);
                  if (charCode > 255) {
                      _free(ptr);
                      throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + 4 + i] = charCode;
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  
  
  
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};
  
  var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up--; up) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      },resolve:function () {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function (from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function () {
        // https://github.com/kripken/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function (dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function (stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function (stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function (stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function (stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function (stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
          }
          for (var i = 0; i < length; i++) {
            try {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function (tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              var fd = process.stdin.fd;
              // Linux and Mac cannot use process.stdin.fd (which isn't set up as sync)
              var usingDevice = false;
              try {
                fd = fs.openSync('/dev/stdin', 'r');
                usingDevice = true;
              } catch (e) {}
  
              bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
  
              if (usingDevice) { fs.closeSync(fd); }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
  
            } else if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['print'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function (tty, val) {
          if (val === null || val === 10) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function (tty) {
          if (tty.output && tty.output.length > 0) {
            Module['printErr'](UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  var MEMFS={ops_table:null,mount:function (mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function (parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.buffer.byteLength which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
        }
        return node;
      },getFileDataAsRegularArray:function (node) {
        if (node.contents && node.contents.subarray) {
          var arr = [];
          for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
          return arr; // Returns a copy of the original data.
        }
        return node.contents; // No-op, the file contents are already in a JS array. Return as-is.
      },getFileDataAsTypedArray:function (node) {
        if (!node.contents) return new Uint8Array;
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function (node, newCapacity) {
        // If we are asked to expand the size of a file that already exists, revert to using a standard JS array to store the file
        // instead of a typed array. This makes resizing the array more flexible because we can just .push() elements at the back to
        // increase the size.
        if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
          node.contents = MEMFS.getFileDataAsRegularArray(node);
          node.usedBytes = node.contents.length; // We might be writing to a lazy-loaded file which had overridden this property, so force-reset it.
        }
  
        if (!node.contents || node.contents.subarray) { // Keep using a typed array if creating a new storage, or if old one was a typed array as well.
          var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
          if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
          // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
          // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
          // avoid overshooting the allocation cap by a very large margin.
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity); // Allocate new storage.
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
          return;
        }
        // Not using a typed array to back the file storage. Use a standard JS array instead.
        if (!node.contents && newCapacity > 0) node.contents = [];
        while (node.contents.length < newCapacity) node.contents.push(0);
      },resizeFileStorage:function (node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
          return;
        }
        if (!node.contents || node.contents.subarray) { // Resize a typed array if that is being used as the backing store.
          var oldContents = node.contents;
          node.contents = new Uint8Array(new ArrayBuffer(newSize)); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
          return;
        }
        // Backing with a JS array.
        if (!node.contents) node.contents = [];
        if (node.contents.length > newSize) node.contents.length = newSize;
        else while (node.contents.length < newSize) node.contents.push(0);
        node.usedBytes = newSize;
      },node_ops:{getattr:function (node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function (node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function (parent, name) {
          throw FS.genericErrors[ERRNO_CODES.ENOENT];
        },mknod:function (parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function (old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          old_node.parent = new_dir;
        },unlink:function (parent, name) {
          delete parent.contents[name];
        },rmdir:function (parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
          }
          delete parent.contents[name];
        },readdir:function (node) {
          var entries = ['.', '..']
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function (parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function (node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return node.link;
        }},stream_ops:{read:function (stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function (stream, buffer, offset, length, position, canOwn) {
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) { // Can we just reuse the buffer we are given?
              assert(position === 0, 'canOwn must imply no weird position inside the file');
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); // Use typed array write if available.
          else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position+length);
          return length;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          return position;
        },allocate:function (stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function (stream, buffer, offset, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if ( !(flags & 2) &&
                (contents.buffer === buffer || contents.buffer === buffer.buffer) ) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < stream.node.usedBytes) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = _malloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
            }
            buffer.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function (stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  
  var IDBFS={dbs:{},indexedDB:function () {
        if (typeof indexedDB !== 'undefined') return indexedDB;
        var ret = null;
        if (typeof window === 'object') ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, 'IDBFS used, but indexedDB not supported');
        return ret;
      },DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:function (mount) {
        // reuse all of the core MEMFS functionality
        return MEMFS.mount.apply(null, arguments);
      },syncfs:function (mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, function(err, remote) {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },getDB:function (name, callback) {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = function() {
          db = req.result;
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },getLocalSet:function (mount, callback) {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return function(p) {
            return PATH.join2(root, p);
          }
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.stat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { timestamp: stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },getRemoteSet:function (mount, callback) {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, function(err, db) {
          if (err) return callback(err);
  
          var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
          transaction.onerror = function(e) {
            callback(this.error);
            e.preventDefault();
          };
  
          var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
          var index = store.index('timestamp');
  
          index.openKeyCursor().onsuccess = function(event) {
            var cursor = event.target.result;
  
            if (!cursor) {
              return callback(null, { type: 'remote', db: db, entries: entries });
            }
  
            entries[cursor.primaryKey] = { timestamp: cursor.key };
  
            cursor.continue();
          };
        });
      },loadLocalEntry:function (path, callback) {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.stat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { timestamp: stat.mtime, mode: stat.mode });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { timestamp: stat.mtime, mode: stat.mode, contents: node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },storeLocalEntry:function (path, entry, callback) {
        try {
          if (FS.isDir(entry.mode)) {
            FS.mkdir(path, entry.mode);
          } else if (FS.isFile(entry.mode)) {
            FS.writeFile(path, entry.contents, { encoding: 'binary', canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry.mode);
          FS.utime(path, entry.timestamp, entry.timestamp);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },removeLocalEntry:function (path, callback) {
        try {
          var lookup = FS.lookupPath(path);
          var stat = FS.stat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else if (FS.isFile(stat.mode)) {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },loadRemoteEntry:function (store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) { callback(null, event.target.result); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },storeRemoteEntry:function (store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },removeRemoteEntry:function (store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() { callback(null); };
        req.onerror = function(e) {
          callback(this.error);
          e.preventDefault();
        };
      },reconcile:function (src, dst, callback) {
        var total = 0;
  
        var create = [];
        Object.keys(src.entries).forEach(function (key) {
          var e = src.entries[key];
          var e2 = dst.entries[key];
          if (!e2 || e.timestamp > e2.timestamp) {
            create.push(key);
            total++;
          }
        });
  
        var remove = [];
        Object.keys(dst.entries).forEach(function (key) {
          var e = dst.entries[key];
          var e2 = src.entries[key];
          if (!e2) {
            remove.push(key);
            total++;
          }
        });
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var completed = 0;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= total) {
            return callback(null);
          }
        };
  
        transaction.onerror = function(e) {
          done(this.error);
          e.preventDefault();
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        create.sort().forEach(function (path) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, function (err, entry) {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        });
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        remove.sort().reverse().forEach(function(path) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        });
      }};
  
  var NODEFS={isWindows:false,staticInit:function () {
        NODEFS.isWindows = !!process.platform.match(/^win/);
      },mount:function (mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
      },createNode:function (parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node;
      },getMode:function (path) {
        var stat;
        try {
          stat = fs.lstatSync(path);
          if (NODEFS.isWindows) {
            // On Windows, directories return permission bits 'rw-rw-rw-', even though they have 'rwxrwxrwx', so
            // propagate write bits to execute bits.
            stat.mode = stat.mode | ((stat.mode & 146) >> 1);
          }
        } catch (e) {
          if (!e.code) throw e;
          throw new FS.ErrnoError(ERRNO_CODES[e.code]);
        }
        return stat.mode;
      },realPath:function (node) {
        var parts = [];
        while (node.parent !== node) {
          parts.push(node.name);
          node = node.parent;
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts);
      },flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function (flags) {
        if (flags in NODEFS.flagsToPermissionStringMap) {
          return NODEFS.flagsToPermissionStringMap[flags];
        } else {
          return flags;
        }
      },node_ops:{getattr:function (node) {
          var path = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs.lstatSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          // node.js v0.10.20 doesn't report blksize and blocks on Windows. Fake them with default blksize of 4096.
          // See http://support.microsoft.com/kb/140365
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size+stat.blksize-1)/stat.blksize|0;
          }
          return {
            dev: stat.dev,
            ino: stat.ino,
            mode: stat.mode,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            rdev: stat.rdev,
            size: stat.size,
            atime: stat.atime,
            mtime: stat.mtime,
            ctime: stat.ctime,
            blksize: stat.blksize,
            blocks: stat.blocks
          };
        },setattr:function (node, attr) {
          var path = NODEFS.realPath(node);
          try {
            if (attr.mode !== undefined) {
              fs.chmodSync(path, attr.mode);
              // update the common node structure mode as well
              node.mode = attr.mode;
            }
            if (attr.timestamp !== undefined) {
              var date = new Date(attr.timestamp);
              fs.utimesSync(path, date, date);
            }
            if (attr.size !== undefined) {
              fs.truncateSync(path, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },lookup:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path);
          return NODEFS.createNode(parent, name, mode);
        },mknod:function (parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          // create the backing node for this in the fs root as well
          var path = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs.mkdirSync(path, node.mode);
            } else {
              fs.writeFileSync(path, '', { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return node;
        },rename:function (oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },unlink:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.unlinkSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },rmdir:function (parent, name) {
          var path = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs.rmdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readdir:function (node) {
          var path = NODEFS.realPath(node);
          try {
            return fs.readdirSync(path);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },symlink:function (parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },readlink:function (node) {
          var path = NODEFS.realPath(node);
          try {
            path = fs.readlinkSync(path);
            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
            return path;
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        }},stream_ops:{open:function (stream) {
          var path = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },close:function (stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
        },read:function (stream, buffer, offset, length, position) {
          if (length === 0) return 0; // node errors on 0 length reads
          // FIXME this is terrible.
          var nbuffer = new Buffer(length);
          var res;
          try {
            res = fs.readSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          if (res > 0) {
            for (var i = 0; i < res; i++) {
              buffer[offset + i] = nbuffer[i];
            }
          }
          return res;
        },write:function (stream, buffer, offset, length, position) {
          // FIXME this is terrible.
          var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
          var res;
          try {
            res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES[e.code]);
          }
          return res;
        },llseek:function (stream, offset, whence) {
          var position = offset;
          if (whence === 1) {  // SEEK_CUR.
            position += stream.position;
          } else if (whence === 2) {  // SEEK_END.
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code]);
              }
            }
          }
  
          if (position < 0) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
  
          return position;
        }}};
  
  var _stdin=allocate(1, "i32*", ALLOC_STATIC);
  
  var _stdout=allocate(1, "i32*", ALLOC_STATIC);
  
  var _stderr=allocate(1, "i32*", ALLOC_STATIC);
  
  function _fflush(stream) {
      // int fflush(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fflush.html
  
      /*
      // Disabled, see https://github.com/kripken/emscripten/issues/2770
      stream = FS.getStreamFromPtr(stream);
      if (stream.stream_ops.flush) {
        stream.stream_ops.flush(stream);
      }
      */
    }var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},handleFSError:function (e) {
        if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
        return ___setErrNo(e.errno);
      },lookupPath:function (path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function (node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function (parentid, name) {
        var hash = 0;
  
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function (node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function (parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
          throw new FS.ErrnoError(err, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function (parent, name, mode, rdev) {
        if (!FS.FSNode) {
          FS.FSNode = function(parent, name, mode, rdev) {
            if (!parent) {
              parent = this;  // root node sets parent to itself
            }
            this.parent = parent;
            this.mount = parent.mount;
            this.mounted = null;
            this.id = FS.nextInode++;
            this.name = name;
            this.mode = mode;
            this.node_ops = {};
            this.stream_ops = {};
            this.rdev = rdev;
          };
  
          FS.FSNode.prototype = {};
  
          // compatibility
          var readMode = 292 | 73;
          var writeMode = 146;
  
          // NOTE we must use Object.defineProperties instead of individual calls to
          // Object.defineProperty in order to make closure compiler happy
          Object.defineProperties(FS.FSNode.prototype, {
            read: {
              get: function() { return (this.mode & readMode) === readMode; },
              set: function(val) { val ? this.mode |= readMode : this.mode &= ~readMode; }
            },
            write: {
              get: function() { return (this.mode & writeMode) === writeMode; },
              set: function(val) { val ? this.mode |= writeMode : this.mode &= ~writeMode; }
            },
            isFolder: {
              get: function() { return FS.isDir(this.mode); }
            },
            isDevice: {
              get: function() { return FS.isChrdev(this.mode); }
            }
          });
        }
  
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function (node) {
        FS.hashRemoveNode(node);
      },isRoot:function (node) {
        return node === node.parent;
      },isMountpoint:function (node) {
        return !!node.mounted;
      },isFile:function (mode) {
        return (mode & 61440) === 32768;
      },isDir:function (mode) {
        return (mode & 61440) === 16384;
      },isLink:function (mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function (mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function (mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function (mode) {
        return (mode & 61440) === 4096;
      },isSocket:function (mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function (str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function (flag) {
        var accmode = flag & 2097155;
        var perms = ['r', 'w', 'rw'][accmode];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function (node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
          return ERRNO_CODES.EACCES;
        } else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
          return ERRNO_CODES.EACCES;
        }
        return 0;
      },mayLookup:function (dir) {
        var err = FS.nodePermissions(dir, 'x');
        if (err) return err;
        if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
        return 0;
      },mayCreate:function (dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return ERRNO_CODES.EEXIST;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function (dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var err = FS.nodePermissions(dir, 'wx');
        if (err) {
          return err;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return ERRNO_CODES.ENOTDIR;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return ERRNO_CODES.EBUSY;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return 0;
      },mayOpen:function (node, flags) {
        if (!node) {
          return ERRNO_CODES.ENOENT;
        }
        if (FS.isLink(node.mode)) {
          return ERRNO_CODES.ELOOP;
        } else if (FS.isDir(node.mode)) {
          if ((flags & 2097155) !== 0 ||  // opening for write
              (flags & 512)) {
            return ERRNO_CODES.EISDIR;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function (fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
      },getStream:function (fd) {
        return FS.streams[fd];
      },createStream:function (stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = function(){};
          FS.FSStream.prototype = {};
          // compatibility
          Object.defineProperties(FS.FSStream.prototype, {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          });
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function (fd) {
        FS.streams[fd] = null;
      },getStreamFromPtr:function (ptr) {
        return FS.streams[ptr - 1];
      },getPtrForStream:function (stream) {
        return stream ? stream.fd + 1 : 0;
      },chrdev_stream_ops:{open:function (stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function () {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }},major:function (dev) {
        return ((dev) >> 8);
      },minor:function (dev) {
        return ((dev) & 0xff);
      },makedev:function (ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function (dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function (dev) {
        return FS.devices[dev];
      },getMounts:function (mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function (populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function done(err) {
          if (err) {
            if (!done.errored) {
              done.errored = true;
              return callback(err);
            }
            return;
          }
          if (++completed >= mounts.length) {
            callback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function (type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.indexOf(current.mount) !== -1) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },lookup:function (parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function (path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function (path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function (path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdev:function (path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function (oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function (old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
        try {
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
        } catch (e) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        // new path should not be an ancestor of the old path
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        err = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          err = FS.nodePermissions(old_dir, 'w');
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        return node.node_ops.readdir(node);
      },unlink:function (path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
          // POSIX says unlink should set EPERM, not EISDIR
          if (err === ERRNO_CODES.EISDIR) err = ERRNO_CODES.EPERM;
          throw new FS.ErrnoError(err);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function (path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        return PATH.resolve(FS.getPath(lookup.node.parent), link.node_ops.readlink(link));
      },stat:function (path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        return node.node_ops.getattr(node);
      },lstat:function (path) {
        return FS.stat(path, true);
      },chmod:function (path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function (path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function (fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chmod(stream.node, mode);
      },chown:function (path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function (path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function (fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function (path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var err = FS.nodePermissions(node, 'w');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function (fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        FS.truncate(stream.node, len);
      },utime:function (path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function (path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var err = FS.mayOpen(node, flags);
          if (err) {
            throw new FS.ErrnoError(err);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            Module['printErr']('read file: ' + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function (stream) {
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
      },llseek:function (stream, offset, whence) {
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function (stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function (stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if (stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = true;
        if (typeof position === 'undefined') {
          position = stream.position;
          seeking = false;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function (stream, offset, length) {
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function (stream, buffer, offset, length, position, prot, flags) {
        // TODO if PROT is PROT_WRITE, make sure we have write access
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(ERRNO_CODES.EACCES);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
      },msync:function (stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function (stream) {
        return 0;
      },ioctl:function (stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function (path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'r';
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function (path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 'w';
        opts.encoding = opts.encoding || 'utf8';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var stream = FS.open(path, opts.flags, opts.mode);
        if (opts.encoding === 'utf8') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
        } else if (opts.encoding === 'binary') {
          FS.write(stream, data, 0, data.length, 0, opts.canOwn);
        }
        FS.close(stream);
      },cwd:function () {
        return FS.currentPath;
      },chdir:function (path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
        }
        var err = FS.nodePermissions(lookup.node, 'x');
        if (err) {
          throw new FS.ErrnoError(err);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function () {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function () {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using Module['printErr']
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device;
        if (typeof crypto !== 'undefined') {
          // for modern web browsers
          var randomBuffer = new Uint8Array(1);
          random_device = function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
        } else if (ENVIRONMENT_IS_NODE) {
          // for nodejs
          random_device = function() { return require('crypto').randomBytes(1)[0]; };
        } else {
          // default for ES5 platforms
          random_device = function() { return (Math.random()*256)|0; };
        }
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createStandardStreams:function () {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 'r');
        HEAP32[((_stdin)>>2)]=FS.getPtrForStream(stdin);
        assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');
  
        var stdout = FS.open('/dev/stdout', 'w');
        HEAP32[((_stdout)>>2)]=FS.getPtrForStream(stdout);
        assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');
  
        var stderr = FS.open('/dev/stderr', 'w');
        HEAP32[((_stderr)>>2)]=FS.getPtrForStream(stderr);
        assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
      },ensureErrnoError:function () {
        if (FS.ErrnoError) return;
        FS.ErrnoError = function ErrnoError(errno, node) {
          this.node = node;
          this.setErrno = function(errno) {
            this.errno = errno;
            for (var key in ERRNO_CODES) {
              if (ERRNO_CODES[key] === errno) {
                this.code = key;
                break;
              }
            }
          };
          this.setErrno(errno);
          this.message = ERRNO_MESSAGES[errno];
          if (this.stack) this.stack = demangleAll(this.stack);
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [ERRNO_CODES.ENOENT].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function () {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
      },init:function (input, output, error) {
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function () {
        FS.init.initialized = false;
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function (canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },joinPath:function (parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == '/') path = path.substr(1);
        return path;
      },absolutePath:function (relative, base) {
        return PATH.resolve(base, relative);
      },standardizePath:function (path) {
        return PATH.normalize(path);
      },findObject:function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },analyzePath:function (path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createFolder:function (parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode);
      },createPath:function (parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function (parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 'w');
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function (parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },createLink:function (parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path);
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        }
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        }
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(xhr.response || []);
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperty(lazyArray, "length", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._length;
              }
          });
          Object.defineProperty(lazyArray, "chunkSize", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._chunkSize;
              }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperty(node, "usedBytes", {
            get: function() { return this.contents.length; }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO);
            }
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          if (!FS.forceLoadFile(node)) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
          }
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function () {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function () {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          console.log('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function (paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};
  
  
  
  
  function _mkport() { throw 'TODO' }var SOCKFS={mount:function (mount) {
        // If Module['websocket'] has already been defined (e.g. for configuring
        // the subprotocol/url) use that, if not initialise it to a new object.
        Module['websocket'] = (Module['websocket'] && 
                               ('object' === typeof Module['websocket'])) ? Module['websocket'] : {};
  
        // Add the Event registration mechanism to the exported websocket configuration
        // object so we can register network callbacks from native JavaScript too.
        // For more documentation see system/include/emscripten/emscripten.h
        Module['websocket']._callbacks = {};
        Module['websocket']['on'] = function(event, callback) {
  	    if ('function' === typeof callback) {
  		  this._callbacks[event] = callback;
          }
  	    return this;
        };
  
        Module['websocket'].emit = function(event, param) {
  	    if ('function' === typeof this._callbacks[event]) {
  		  this._callbacks[event].call(this, param);
          }
        };
  
        // If debug is enabled register simple default logging callbacks for each Event.
  
        return FS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createSocket:function (family, type, protocol) {
        var streaming = type == 1;
        if (protocol) {
          assert(streaming == (protocol == 6)); // if SOCK_STREAM, must be tcp
        }
  
        // create our internal socket structure
        var sock = {
          family: family,
          type: type,
          protocol: protocol,
          server: null,
          error: null, // Used in getsockopt for SOL_SOCKET/SO_ERROR test
          peers: {},
          pending: [],
          recv_queue: [],
          sock_ops: SOCKFS.websocket_sock_ops
        };
  
        // create the filesystem node to store the socket structure
        var name = SOCKFS.nextname();
        var node = FS.createNode(SOCKFS.root, name, 49152, 0);
        node.sock = sock;
  
        // and the wrapping stream that enables library functions such
        // as read and write to indirectly interact with the socket
        var stream = FS.createStream({
          path: name,
          node: node,
          flags: FS.modeStringToFlags('r+'),
          seekable: false,
          stream_ops: SOCKFS.stream_ops
        });
  
        // map the new stream to the socket structure (sockets have a 1:1
        // relationship with a stream)
        sock.stream = stream;
  
        return sock;
      },getSocket:function (fd) {
        var stream = FS.getStream(fd);
        if (!stream || !FS.isSocket(stream.node.mode)) {
          return null;
        }
        return stream.node.sock;
      },stream_ops:{poll:function (stream) {
          var sock = stream.node.sock;
          return sock.sock_ops.poll(sock);
        },ioctl:function (stream, request, varargs) {
          var sock = stream.node.sock;
          return sock.sock_ops.ioctl(sock, request, varargs);
        },read:function (stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          var msg = sock.sock_ops.recvmsg(sock, length);
          if (!msg) {
            // socket is closed
            return 0;
          }
          buffer.set(msg.buffer, offset);
          return msg.buffer.length;
        },write:function (stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          return sock.sock_ops.sendmsg(sock, buffer, offset, length);
        },close:function (stream) {
          var sock = stream.node.sock;
          sock.sock_ops.close(sock);
        }},nextname:function () {
        if (!SOCKFS.nextname.current) {
          SOCKFS.nextname.current = 0;
        }
        return 'socket[' + (SOCKFS.nextname.current++) + ']';
      },websocket_sock_ops:{createPeer:function (sock, addr, port) {
          var ws;
  
          if (typeof addr === 'object') {
            ws = addr;
            addr = null;
            port = null;
          }
  
          if (ws) {
            // for sockets that've already connected (e.g. we're the server)
            // we can inspect the _socket property for the address
            if (ws._socket) {
              addr = ws._socket.remoteAddress;
              port = ws._socket.remotePort;
            }
            // if we're just now initializing a connection to the remote,
            // inspect the url property
            else {
              var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
              if (!result) {
                throw new Error('WebSocket URL must be in the format ws(s)://address:port');
              }
              addr = result[1];
              port = parseInt(result[2], 10);
            }
          } else {
            // create the actual websocket object and connect
            try {
              // runtimeConfig gets set to true if WebSocket runtime configuration is available.
              var runtimeConfig = (Module['websocket'] && ('object' === typeof Module['websocket']));
  
              // The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
              // comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
              var url = 'ws:#'.replace('#', '//');
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['url']) {
                  url = Module['websocket']['url']; // Fetch runtime WebSocket URL config.
                }
              }
  
              if (url === 'ws://' || url === 'wss://') { // Is the supplied URL config just a prefix, if so complete it.
                var parts = addr.split('/');
                url = url + parts[0] + ":" + port + "/" + parts.slice(1).join('/');
              }
  
              // Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
              var subProtocols = 'binary'; // The default value is 'binary'
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['subprotocol']) {
                  subProtocols = Module['websocket']['subprotocol']; // Fetch runtime WebSocket subprotocol config.
                }
              }
  
              // The regex trims the string (removes spaces at the beginning and end, then splits the string by
              // <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
              subProtocols = subProtocols.replace(/^ +| +$/g,"").split(/ *, */);
  
              // The node ws library API for specifying optional subprotocol is slightly different than the browser's.
              var opts = ENVIRONMENT_IS_NODE ? {'protocol': subProtocols.toString()} : subProtocols;
  
              // If node we use the ws library.
              var WebSocket = ENVIRONMENT_IS_NODE ? require('ws') : window['WebSocket'];
              ws = new WebSocket(url, opts);
              ws.binaryType = 'arraybuffer';
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
            }
          }
  
  
          var peer = {
            addr: addr,
            port: port,
            socket: ws,
            dgram_send_queue: []
          };
  
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
  
          // if this is a bound dgram socket, send the port number first to allow
          // us to override the ephemeral port reported to us by remotePort on the
          // remote end.
          if (sock.type === 2 && typeof sock.sport !== 'undefined') {
            peer.dgram_send_queue.push(new Uint8Array([
                255, 255, 255, 255,
                'p'.charCodeAt(0), 'o'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0),
                ((sock.sport & 0xff00) >> 8) , (sock.sport & 0xff)
            ]));
          }
  
          return peer;
        },getPeer:function (sock, addr, port) {
          return sock.peers[addr + ':' + port];
        },addPeer:function (sock, peer) {
          sock.peers[peer.addr + ':' + peer.port] = peer;
        },removePeer:function (sock, peer) {
          delete sock.peers[peer.addr + ':' + peer.port];
        },handlePeerEvents:function (sock, peer) {
          var first = true;
  
          var handleOpen = function () {
  
            Module['websocket'].emit('open', sock.stream.fd);
  
            try {
              var queued = peer.dgram_send_queue.shift();
              while (queued) {
                peer.socket.send(queued);
                queued = peer.dgram_send_queue.shift();
              }
            } catch (e) {
              // not much we can do here in the way of proper error handling as we've already
              // lied and said this data was sent. shut it down.
              peer.socket.close();
            }
          };
  
          function handleMessage(data) {
            assert(typeof data !== 'string' && data.byteLength !== undefined);  // must receive an ArrayBuffer
            data = new Uint8Array(data);  // make a typed array view on the array buffer
  
  
            // if this is the port message, override the peer's port with it
            var wasfirst = first;
            first = false;
            if (wasfirst &&
                data.length === 10 &&
                data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 &&
                data[4] === 'p'.charCodeAt(0) && data[5] === 'o'.charCodeAt(0) && data[6] === 'r'.charCodeAt(0) && data[7] === 't'.charCodeAt(0)) {
              // update the peer's port and it's key in the peer map
              var newport = ((data[8] << 8) | data[9]);
              SOCKFS.websocket_sock_ops.removePeer(sock, peer);
              peer.port = newport;
              SOCKFS.websocket_sock_ops.addPeer(sock, peer);
              return;
            }
  
            sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
            Module['websocket'].emit('message', sock.stream.fd);
          };
  
          if (ENVIRONMENT_IS_NODE) {
            peer.socket.on('open', handleOpen);
            peer.socket.on('message', function(data, flags) {
              if (!flags.binary) {
                return;
              }
              handleMessage((new Uint8Array(data)).buffer);  // copy from node Buffer -> ArrayBuffer
            });
            peer.socket.on('close', function() {
              Module['websocket'].emit('close', sock.stream.fd);
            });
            peer.socket.on('error', function(error) {
              // Although the ws library may pass errors that may be more descriptive than
              // ECONNREFUSED they are not necessarily the expected error code e.g. 
              // ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
              // is still probably the most useful thing to do.
              sock.error = ERRNO_CODES.ECONNREFUSED; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
              // don't throw
            });
          } else {
            peer.socket.onopen = handleOpen;
            peer.socket.onclose = function() {
              Module['websocket'].emit('close', sock.stream.fd);
            };
            peer.socket.onmessage = function peer_socket_onmessage(event) {
              handleMessage(event.data);
            };
            peer.socket.onerror = function(error) {
              // The WebSocket spec only allows a 'simple event' to be thrown on error,
              // so we only really know as much as ECONNREFUSED.
              sock.error = ERRNO_CODES.ECONNREFUSED; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
            };
          }
        },poll:function (sock) {
          if (sock.type === 1 && sock.server) {
            // listen sockets should only say they're available for reading
            // if there are pending clients.
            return sock.pending.length ? (64 | 1) : 0;
          }
  
          var mask = 0;
          var dest = sock.type === 1 ?  // we only care about the socket state for connection-based sockets
            SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) :
            null;
  
          if (sock.recv_queue.length ||
              !dest ||  // connection-less sockets are always ready to read
              (dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {  // let recv return 0 once closed
            mask |= (64 | 1);
          }
  
          if (!dest ||  // connection-less sockets are always ready to write
              (dest && dest.socket.readyState === dest.socket.OPEN)) {
            mask |= 4;
          }
  
          if ((dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {
            mask |= 16;
          }
  
          return mask;
        },ioctl:function (sock, request, arg) {
          switch (request) {
            case 21531:
              var bytes = 0;
              if (sock.recv_queue.length) {
                bytes = sock.recv_queue[0].data.length;
              }
              HEAP32[((arg)>>2)]=bytes;
              return 0;
            default:
              return ERRNO_CODES.EINVAL;
          }
        },close:function (sock) {
          // if we've spawned a listen server, close it
          if (sock.server) {
            try {
              sock.server.close();
            } catch (e) {
            }
            sock.server = null;
          }
          // close any peer connections
          var peers = Object.keys(sock.peers);
          for (var i = 0; i < peers.length; i++) {
            var peer = sock.peers[peers[i]];
            try {
              peer.socket.close();
            } catch (e) {
            }
            SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          }
          return 0;
        },bind:function (sock, addr, port) {
          if (typeof sock.saddr !== 'undefined' || typeof sock.sport !== 'undefined') {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already bound
          }
          sock.saddr = addr;
          sock.sport = port || _mkport();
          // in order to emulate dgram sockets, we need to launch a listen server when
          // binding on a connection-less socket
          // note: this is only required on the server side
          if (sock.type === 2) {
            // close the existing server if it exists
            if (sock.server) {
              sock.server.close();
              sock.server = null;
            }
            // swallow error operation not supported error that occurs when binding in the
            // browser where this isn't supported
            try {
              sock.sock_ops.listen(sock, 0);
            } catch (e) {
              if (!(e instanceof FS.ErrnoError)) throw e;
              if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e;
            }
          }
        },connect:function (sock, addr, port) {
          if (sock.server) {
            throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
          }
  
          // TODO autobind
          // if (!sock.addr && sock.type == 2) {
          // }
  
          // early out if we're already connected / in the middle of connecting
          if (typeof sock.daddr !== 'undefined' && typeof sock.dport !== 'undefined') {
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
            if (dest) {
              if (dest.socket.readyState === dest.socket.CONNECTING) {
                throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
              } else {
                throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
              }
            }
          }
  
          // add the socket to our peer list and set our
          // destination address / port to match
          var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          sock.daddr = peer.addr;
          sock.dport = peer.port;
  
          // always "fail" in non-blocking mode
          throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        },listen:function (sock, backlog) {
          if (!ENVIRONMENT_IS_NODE) {
            throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
          }
          if (sock.server) {
             throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already listening
          }
          var WebSocketServer = require('ws').Server;
          var host = sock.saddr;
          sock.server = new WebSocketServer({
            host: host,
            port: sock.sport
            // TODO support backlog
          });
          Module['websocket'].emit('listen', sock.stream.fd); // Send Event with listen fd.
  
          sock.server.on('connection', function(ws) {
            if (sock.type === 1) {
              var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
  
              // create a peer on the new socket
              var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
              newsock.daddr = peer.addr;
              newsock.dport = peer.port;
  
              // push to queue for accept to pick up
              sock.pending.push(newsock);
              Module['websocket'].emit('connection', newsock.stream.fd);
            } else {
              // create a peer on the listen socket so calling sendto
              // with the listen socket and an address will resolve
              // to the correct client
              SOCKFS.websocket_sock_ops.createPeer(sock, ws);
              Module['websocket'].emit('connection', sock.stream.fd);
            }
          });
          sock.server.on('closed', function() {
            Module['websocket'].emit('close', sock.stream.fd);
            sock.server = null;
          });
          sock.server.on('error', function(error) {
            // Although the ws library may pass errors that may be more descriptive than
            // ECONNREFUSED they are not necessarily the expected error code e.g. 
            // ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
            // is still probably the most useful thing to do. This error shouldn't
            // occur in a well written app as errors should get trapped in the compiled
            // app's own getaddrinfo call.
            sock.error = ERRNO_CODES.EHOSTUNREACH; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
            Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'EHOSTUNREACH: Host is unreachable']);
            // don't throw
          });
        },accept:function (listensock) {
          if (!listensock.server) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          var newsock = listensock.pending.shift();
          newsock.stream.flags = listensock.stream.flags;
          return newsock;
        },getname:function (sock, peer) {
          var addr, port;
          if (peer) {
            if (sock.daddr === undefined || sock.dport === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            }
            addr = sock.daddr;
            port = sock.dport;
          } else {
            // TODO saddr and sport will be set for bind()'d UDP sockets, but what
            // should we be returning for TCP sockets that've been connect()'d?
            addr = sock.saddr || 0;
            port = sock.sport || 0;
          }
          return { addr: addr, port: port };
        },sendmsg:function (sock, buffer, offset, length, addr, port) {
          if (sock.type === 2) {
            // connection-less sockets will honor the message address,
            // and otherwise fall back to the bound destination address
            if (addr === undefined || port === undefined) {
              addr = sock.daddr;
              port = sock.dport;
            }
            // if there was no address to fall back to, error out
            if (addr === undefined || port === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
            }
          } else {
            // connection-based sockets will only use the bound
            addr = sock.daddr;
            port = sock.dport;
          }
  
          // find the peer for the destination address
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
  
          // early out if not connected with a connection-based socket
          if (sock.type === 1) {
            if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            } else if (dest.socket.readyState === dest.socket.CONNECTING) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
  
          // create a copy of the incoming data to send, as the WebSocket API
          // doesn't work entirely with an ArrayBufferView, it'll just send
          // the entire underlying buffer
          var data;
          if (buffer instanceof Array || buffer instanceof ArrayBuffer) {
            data = buffer.slice(offset, offset + length);
          } else {  // ArrayBufferView
            data = buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + offset + length);
          }
  
          // if we're emulating a connection-less dgram socket and don't have
          // a cached connection, queue the buffer to send upon connect and
          // lie, saying the data was sent now.
          if (sock.type === 2) {
            if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
              // if we're not connected, open a new connection
              if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
              }
              dest.dgram_send_queue.push(data);
              return length;
            }
          }
  
          try {
            // send the actual data
            dest.socket.send(data);
            return length;
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
        },recvmsg:function (sock, length) {
          // http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
          if (sock.type === 1 && sock.server) {
            // tcp servers should not be recv()'ing on the listen socket
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          }
  
          var queued = sock.recv_queue.shift();
          if (!queued) {
            if (sock.type === 1) {
              var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
  
              if (!dest) {
                // if we have a destination address but are not connected, error out
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
              }
              else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                // return null if the socket has closed
                return null;
              }
              else {
                // else, our socket is in a valid state but truly has nothing available
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
            } else {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
  
          // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
          // requeued TCP data it'll be an ArrayBufferView
          var queuedLength = queued.data.byteLength || queued.data.length;
          var queuedOffset = queued.data.byteOffset || 0;
          var queuedBuffer = queued.data.buffer || queued.data;
          var bytesRead = Math.min(length, queuedLength);
          var res = {
            buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
            addr: queued.addr,
            port: queued.port
          };
  
  
          // push back any unread data for TCP connections
          if (sock.type === 1 && bytesRead < queuedLength) {
            var bytesRemaining = queuedLength - bytesRead;
            queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
            sock.recv_queue.unshift(queued);
          }
  
          return res;
        }}};function _send(fd, buf, len, flags) {
      var sock = SOCKFS.getSocket(fd);
      if (!sock) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      // TODO honor flags
      return _write(fd, buf, len);
    }
  
  function _pwrite(fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte, offset);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }function _write(fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.getStream(fildes);
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
  
  
      try {
        var slab = HEAP8;
        return FS.write(stream, slab, buf, nbyte);
      } catch (e) {
        FS.handleFSError(e);
        return -1;
      }
    }
  
  function _fileno(stream) {
      // int fileno(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fileno.html
      stream = FS.getStreamFromPtr(stream);
      if (!stream) return -1;
      return stream.fd;
    }function _fwrite(ptr, size, nitems, stream) {
      // size_t fwrite(const void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fwrite.html
      var bytesToWrite = nitems * size;
      if (bytesToWrite == 0) return 0;
      var fd = _fileno(stream);
      var bytesWritten = _write(fd, ptr, bytesToWrite);
      if (bytesWritten == -1) {
        var streamObj = FS.getStreamFromPtr(stream);
        if (streamObj) streamObj.error = true;
        return 0;
      } else {
        return (bytesWritten / size)|0;
      }
    }
  
  
   
  Module["_strlen"] = _strlen;
  
  function __reallyNegative(x) {
      return x < 0 || (x === 0 && (1/x) === -Infinity);
    }function __formatString(format, varargs) {
      assert((varargs & 3) === 0);
      var textIndex = format;
      var argIndex = 0;
      function getNextArg(type) {
        // NOTE: Explicitly ignoring type safety. Otherwise this fails:
        //       int x = 4; printf("%c\n", (char)x);
        var ret;
        argIndex = Runtime.prepVararg(argIndex, type);
        if (type === 'double') {
          ret = (HEAP32[((tempDoublePtr)>>2)]=HEAP32[(((varargs)+(argIndex))>>2)],HEAP32[(((tempDoublePtr)+(4))>>2)]=HEAP32[(((varargs)+((argIndex)+(4)))>>2)],(+(HEAPF64[(tempDoublePtr)>>3])));
          argIndex += 8;
        } else if (type == 'i64') {
          ret = [HEAP32[(((varargs)+(argIndex))>>2)],
                 HEAP32[(((varargs)+(argIndex+4))>>2)]];
  
          argIndex += 8;
        } else {
          assert((argIndex & 3) === 0);
          type = 'i32'; // varargs are always i32, i64, or double
          ret = HEAP32[(((varargs)+(argIndex))>>2)];
          argIndex += 4;
        }
        return ret;
      }
  
      var ret = [];
      var curr, next, currArg;
      while(1) {
        var startTextIndex = textIndex;
        curr = HEAP8[((textIndex)>>0)];
        if (curr === 0) break;
        next = HEAP8[((textIndex+1)>>0)];
        if (curr == 37) {
          // Handle flags.
          var flagAlwaysSigned = false;
          var flagLeftAlign = false;
          var flagAlternative = false;
          var flagZeroPad = false;
          var flagPadSign = false;
          flagsLoop: while (1) {
            switch (next) {
              case 43:
                flagAlwaysSigned = true;
                break;
              case 45:
                flagLeftAlign = true;
                break;
              case 35:
                flagAlternative = true;
                break;
              case 48:
                if (flagZeroPad) {
                  break flagsLoop;
                } else {
                  flagZeroPad = true;
                  break;
                }
              case 32:
                flagPadSign = true;
                break;
              default:
                break flagsLoop;
            }
            textIndex++;
            next = HEAP8[((textIndex+1)>>0)];
          }
  
          // Handle width.
          var width = 0;
          if (next == 42) {
            width = getNextArg('i32');
            textIndex++;
            next = HEAP8[((textIndex+1)>>0)];
          } else {
            while (next >= 48 && next <= 57) {
              width = width * 10 + (next - 48);
              textIndex++;
              next = HEAP8[((textIndex+1)>>0)];
            }
          }
  
          // Handle precision.
          var precisionSet = false, precision = -1;
          if (next == 46) {
            precision = 0;
            precisionSet = true;
            textIndex++;
            next = HEAP8[((textIndex+1)>>0)];
            if (next == 42) {
              precision = getNextArg('i32');
              textIndex++;
            } else {
              while(1) {
                var precisionChr = HEAP8[((textIndex+1)>>0)];
                if (precisionChr < 48 ||
                    precisionChr > 57) break;
                precision = precision * 10 + (precisionChr - 48);
                textIndex++;
              }
            }
            next = HEAP8[((textIndex+1)>>0)];
          }
          if (precision < 0) {
            precision = 6; // Standard default.
            precisionSet = false;
          }
  
          // Handle integer sizes. WARNING: These assume a 32-bit architecture!
          var argSize;
          switch (String.fromCharCode(next)) {
            case 'h':
              var nextNext = HEAP8[((textIndex+2)>>0)];
              if (nextNext == 104) {
                textIndex++;
                argSize = 1; // char (actually i32 in varargs)
              } else {
                argSize = 2; // short (actually i32 in varargs)
              }
              break;
            case 'l':
              var nextNext = HEAP8[((textIndex+2)>>0)];
              if (nextNext == 108) {
                textIndex++;
                argSize = 8; // long long
              } else {
                argSize = 4; // long
              }
              break;
            case 'L': // long long
            case 'q': // int64_t
            case 'j': // intmax_t
              argSize = 8;
              break;
            case 'z': // size_t
            case 't': // ptrdiff_t
            case 'I': // signed ptrdiff_t or unsigned size_t
              argSize = 4;
              break;
            default:
              argSize = null;
          }
          if (argSize) textIndex++;
          next = HEAP8[((textIndex+1)>>0)];
  
          // Handle type specifier.
          switch (String.fromCharCode(next)) {
            case 'd': case 'i': case 'u': case 'o': case 'x': case 'X': case 'p': {
              // Integer.
              var signed = next == 100 || next == 105;
              argSize = argSize || 4;
              var currArg = getNextArg('i' + (argSize * 8));
              var origArg = currArg;
              var argText;
              // Flatten i64-1 [low, high] into a (slightly rounded) double
              if (argSize == 8) {
                currArg = Runtime.makeBigInt(currArg[0], currArg[1], next == 117);
              }
              // Truncate to requested size.
              if (argSize <= 4) {
                var limit = Math.pow(256, argSize) - 1;
                currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
              }
              // Format the number.
              var currAbsArg = Math.abs(currArg);
              var prefix = '';
              if (next == 100 || next == 105) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], null); else
                argText = reSign(currArg, 8 * argSize, 1).toString(10);
              } else if (next == 117) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], true); else
                argText = unSign(currArg, 8 * argSize, 1).toString(10);
                currArg = Math.abs(currArg);
              } else if (next == 111) {
                argText = (flagAlternative ? '0' : '') + currAbsArg.toString(8);
              } else if (next == 120 || next == 88) {
                prefix = (flagAlternative && currArg != 0) ? '0x' : '';
                if (argSize == 8 && i64Math) {
                  if (origArg[1]) {
                    argText = (origArg[1]>>>0).toString(16);
                    var lower = (origArg[0]>>>0).toString(16);
                    while (lower.length < 8) lower = '0' + lower;
                    argText += lower;
                  } else {
                    argText = (origArg[0]>>>0).toString(16);
                  }
                } else
                if (currArg < 0) {
                  // Represent negative numbers in hex as 2's complement.
                  currArg = -currArg;
                  argText = (currAbsArg - 1).toString(16);
                  var buffer = [];
                  for (var i = 0; i < argText.length; i++) {
                    buffer.push((0xF - parseInt(argText[i], 16)).toString(16));
                  }
                  argText = buffer.join('');
                  while (argText.length < argSize * 2) argText = 'f' + argText;
                } else {
                  argText = currAbsArg.toString(16);
                }
                if (next == 88) {
                  prefix = prefix.toUpperCase();
                  argText = argText.toUpperCase();
                }
              } else if (next == 112) {
                if (currAbsArg === 0) {
                  argText = '(nil)';
                } else {
                  prefix = '0x';
                  argText = currAbsArg.toString(16);
                }
              }
              if (precisionSet) {
                while (argText.length < precision) {
                  argText = '0' + argText;
                }
              }
  
              // Add sign if needed
              if (currArg >= 0) {
                if (flagAlwaysSigned) {
                  prefix = '+' + prefix;
                } else if (flagPadSign) {
                  prefix = ' ' + prefix;
                }
              }
  
              // Move sign to prefix so we zero-pad after the sign
              if (argText.charAt(0) == '-') {
                prefix = '-' + prefix;
                argText = argText.substr(1);
              }
  
              // Add padding.
              while (prefix.length + argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad) {
                    argText = '0' + argText;
                  } else {
                    prefix = ' ' + prefix;
                  }
                }
              }
  
              // Insert the result into the buffer.
              argText = prefix + argText;
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': {
              // Float.
              var currArg = getNextArg('double');
              var argText;
              if (isNaN(currArg)) {
                argText = 'nan';
                flagZeroPad = false;
              } else if (!isFinite(currArg)) {
                argText = (currArg < 0 ? '-' : '') + 'inf';
                flagZeroPad = false;
              } else {
                var isGeneral = false;
                var effectivePrecision = Math.min(precision, 20);
  
                // Convert g/G to f/F or e/E, as per:
                // http://pubs.opengroup.org/onlinepubs/9699919799/functions/printf.html
                if (next == 103 || next == 71) {
                  isGeneral = true;
                  precision = precision || 1;
                  var exponent = parseInt(currArg.toExponential(effectivePrecision).split('e')[1], 10);
                  if (precision > exponent && exponent >= -4) {
                    next = ((next == 103) ? 'f' : 'F').charCodeAt(0);
                    precision -= exponent + 1;
                  } else {
                    next = ((next == 103) ? 'e' : 'E').charCodeAt(0);
                    precision--;
                  }
                  effectivePrecision = Math.min(precision, 20);
                }
  
                if (next == 101 || next == 69) {
                  argText = currArg.toExponential(effectivePrecision);
                  // Make sure the exponent has at least 2 digits.
                  if (/[eE][-+]\d$/.test(argText)) {
                    argText = argText.slice(0, -1) + '0' + argText.slice(-1);
                  }
                } else if (next == 102 || next == 70) {
                  argText = currArg.toFixed(effectivePrecision);
                  if (currArg === 0 && __reallyNegative(currArg)) {
                    argText = '-' + argText;
                  }
                }
  
                var parts = argText.split('e');
                if (isGeneral && !flagAlternative) {
                  // Discard trailing zeros and periods.
                  while (parts[0].length > 1 && parts[0].indexOf('.') != -1 &&
                         (parts[0].slice(-1) == '0' || parts[0].slice(-1) == '.')) {
                    parts[0] = parts[0].slice(0, -1);
                  }
                } else {
                  // Make sure we have a period in alternative mode.
                  if (flagAlternative && argText.indexOf('.') == -1) parts[0] += '.';
                  // Zero pad until required precision.
                  while (precision > effectivePrecision++) parts[0] += '0';
                }
                argText = parts[0] + (parts.length > 1 ? 'e' + parts[1] : '');
  
                // Capitalize 'E' if needed.
                if (next == 69) argText = argText.toUpperCase();
  
                // Add sign.
                if (currArg >= 0) {
                  if (flagAlwaysSigned) {
                    argText = '+' + argText;
                  } else if (flagPadSign) {
                    argText = ' ' + argText;
                  }
                }
              }
  
              // Add padding.
              while (argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad && (argText[0] == '-' || argText[0] == '+')) {
                    argText = argText[0] + '0' + argText.slice(1);
                  } else {
                    argText = (flagZeroPad ? '0' : ' ') + argText;
                  }
                }
              }
  
              // Adjust case.
              if (next < 97) argText = argText.toUpperCase();
  
              // Insert the result into the buffer.
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 's': {
              // String.
              var arg = getNextArg('i8*');
              var argLength = arg ? _strlen(arg) : '(null)'.length;
              if (precisionSet) argLength = Math.min(argLength, precision);
              if (!flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              if (arg) {
                for (var i = 0; i < argLength; i++) {
                  ret.push(HEAPU8[((arg++)>>0)]);
                }
              } else {
                ret = ret.concat(intArrayFromString('(null)'.substr(0, argLength), true));
              }
              if (flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              break;
            }
            case 'c': {
              // Character.
              if (flagLeftAlign) ret.push(getNextArg('i8'));
              while (--width > 0) {
                ret.push(32);
              }
              if (!flagLeftAlign) ret.push(getNextArg('i8'));
              break;
            }
            case 'n': {
              // Write the length written so far to the next parameter.
              var ptr = getNextArg('i32*');
              HEAP32[((ptr)>>2)]=ret.length;
              break;
            }
            case '%': {
              // Literal percent sign.
              ret.push(curr);
              break;
            }
            default: {
              // Unknown specifiers remain untouched.
              for (var i = startTextIndex; i < textIndex + 2; i++) {
                ret.push(HEAP8[((i)>>0)]);
              }
            }
          }
          textIndex += 2;
          // TODO: Support a/A (hex float) and m (last error) specifiers.
          // TODO: Support %1${specifier} for arg selection.
        } else {
          ret.push(curr);
          textIndex += 1;
        }
      }
      return ret;
    }function _fprintf(stream, format, varargs) {
      // int fprintf(FILE *restrict stream, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var result = __formatString(format, varargs);
      var stack = Runtime.stackSave();
      var ret = _fwrite(allocate(result, 'i8', ALLOC_STACK), 1, result.length, stream);
      Runtime.stackRestore(stack);
      return ret;
    }function _printf(format, varargs) {
      // int printf(const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var stdout = HEAP32[((_stdout)>>2)];
      return _fprintf(stdout, format, varargs);
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Runtime.dynCall('v', func);
      _pthread_once.seen[ptr] = 1;
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              var ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  
  var _throwInternalError=undefined;function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
      }
    }
  
  function requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = asm['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = asm['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = requireFunction(downcastSignature, downcast);
      }
      rawDestructor = requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }


  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }

  function _fputc(c, stream) {
      // int fputc(int c, FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputc.html
      var chr = unSign(c & 0xFF);
      HEAP8[((_fputc.ret)>>0)]=chr;
      var fd = _fileno(stream);
      var ret = _write(fd, _fputc.ret, 1);
      if (ret == -1) {
        var streamObj = FS.getStreamFromPtr(stream);
        if (streamObj) streamObj.error = true;
        return -1;
      } else {
        return chr;
      }
    }

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

  function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

  var _emscripten_postinvoke=true;

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 1; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }
  
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
      
      var fromWireType = function(value) {
          return value;
      };
      
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return value | 0;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
          setTimeout(Browser.mainLoop.runner, value); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      }
      return 0;
    }function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          Module.printErr('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(function() {
          if (typeof arg !== 'undefined') {
            Runtime.dynCall('vi', func, [arg]);
          } else {
            Runtime.dynCall('v', func);
          }
        });
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        var canvas = Module['canvas'];
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas ||
                                document['msPointerLockElement'] === canvas;
        }
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && canvas.requestPointerLock) {
                canvas.requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          contextHandle = GL.createContext(canvas, contextAttributes);
          if (contextHandle) {
            ctx = GL.getContext(contextHandle).GLctx;
          }
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement'] ||
               document['msFullScreenElement'] || document['msFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'] ||
                                      document['msExitFullscreen'] ||
                                      document['exitFullscreen'] ||
                                      function() {};
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else {
            
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
            
            if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
          Browser.updateCanvasDimensions(canvas);
        }
  
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
          document.addEventListener('MSFullscreenChange', fullScreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullScreen = canvasContainer['requestFullScreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullScreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullScreen();
        }
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function requestAnimationFrame(func) {
        if (typeof window === 'undefined') { // Provide fallback to setTimeout if window is undefined (e.g. in Node.js)
          Browser.fakeRequestAnimationFrame(func);
        } else {
          if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                           window['mozRequestAnimationFrame'] ||
                                           window['webkitRequestAnimationFrame'] ||
                                           window['msRequestAnimationFrame'] ||
                                           window['oRequestAnimationFrame'] ||
                                           Browser.fakeRequestAnimationFrame;
          }
          window.requestAnimationFrame(func);
        }
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll': 
            delta = event.detail;
            break;
          case 'mousewheel': 
            delta = event.wheelDelta;
            break;
          case 'wheel': 
            delta = event['deltaY'];
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          
          // check if SDL is available
          if (typeof SDL != "undefined") {
          	Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          	Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
          	// just add the mouse delta to the current absolut mouse position
          	// FIXME: ideally this should be clamped against the canvas size and zero
          	Browser.mouseX += Browser.mouseMovementX;
          	Browser.mouseY += Browser.mouseMovementY;
          }        
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
            
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            } 
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        // check if SDL is available   
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available       
        if (typeof SDL != "undefined") {
        	var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        	flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        	HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        }
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
             document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
             document['fullScreenElement'] || document['fullscreenElement'] ||
             document['msFullScreenElement'] || document['msFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

   
  Module["_i64Add"] = _i64Add;

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  var _emscripten_resume=true;

  function _vfprintf(s, f, va_arg) {
      return _fprintf(s, f, HEAP32[((va_arg)>>2)]);
    }

  function ___cxa_begin_catch(ptr) {
      __ZSt18uncaught_exceptionv.uncaught_exception--;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  var _llvm_pow_f64=Math_pow;

  function __embind_register_enum_value(
      rawEnumType,
      name,
      enumValue
    ) {
      var enumType = requireRegisteredType(rawEnumType, 'enum');
      name = readLatin1String(name);
  
      var Enum = enumType.constructor;
  
      var Value = Object.create(enumType.constructor.prototype, {
          value: {value: enumValue},
          constructor: {value: createNamedFunction(enumType.name + '_' + name, function() {})},
      });
      Enum.values[enumValue] = Value;
      Enum[name] = Value;
    }

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

   
  Module["_memmove"] = _memmove;

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  var _emscripten_preinvoke=true;

  function ___gxx_personality_v0() {
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  
  function ___cxa_free_exception(ptr) {
      try {
        return _free(ptr);
      } catch(e) { // XXX FIXME
        Module.printErr('exception during cxa_free_exception: ' + e);
      }
    }function ___cxa_end_catch() {
      if (___cxa_end_catch.rethrown) {
        ___cxa_end_catch.rethrown = false;
        return;
      }
      // Clear state flag.
      asm['setThrew'](0);
      // Call destructor if one is registered then clear it.
      var ptr = EXCEPTIONS.caught.pop();
      if (ptr) {
        EXCEPTIONS.decRef(EXCEPTIONS.deAdjust(ptr));
        EXCEPTIONS.last = 0; // XXX in decRef?
      }
    }

  
  function enumReadValueFromPointer(name, shift, signed) {
      switch (shift) {
          case 0: return function(pointer) {
              var heap = signed ? HEAP8 : HEAPU8;
              return this['fromWireType'](heap[pointer]);
          };
          case 1: return function(pointer) {
              var heap = signed ? HEAP16 : HEAPU16;
              return this['fromWireType'](heap[pointer >> 1]);
          };
          case 2: return function(pointer) {
              var heap = signed ? HEAP32 : HEAPU32;
              return this['fromWireType'](heap[pointer >> 2]);
          };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_enum(
      rawType,
      name,
      size,
      isSigned
    ) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
  
      function constructor() {
      }
      constructor.values = {};
  
      registerType(rawType, {
          name: name,
          constructor: constructor,
          'fromWireType': function(c) {
              return this.constructor.values[c];
          },
          'toWireType': function(destructors, c) {
              return c.value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': enumReadValueFromPointer(name, shift, isSigned),
          destructorFunction: null,
      });
      exposePublicSymbol(name, constructor);
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      var returns = (argTypes[0].name !== "void");
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }

embind_init_charCodes()
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');
___errno_state = Runtime.staticAlloc(4); HEAP32[((___errno_state)>>2)]=0;
FS.staticInit();__ATINIT__.unshift(function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() });__ATMAIN__.push(function() { FS.ignorePermissions = false });__ATEXIT__.push(function() { FS.quit() });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;
__ATINIT__.unshift(function() { TTY.init() });__ATEXIT__.push(function() { TTY.shutdown() });
if (ENVIRONMENT_IS_NODE) { var fs = require("fs"); var NODEJS_PATH = require("path"); NODEFS.staticInit(); }
__ATINIT__.push(function() { SOCKFS.root = FS.mount(SOCKFS, {}, null); });
init_ClassHandle()
init_RegisteredPointer()
init_embind();
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');
_fputc.ret = allocate([0], "i8", ALLOC_STATIC);
init_emval();
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


function nullFunc_iiiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_i(x) { Module["printErr"]("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { Module["printErr"]("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { Module["printErr"]("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viii(x) { Module["printErr"]("Invalid function pointer called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { Module["printErr"]("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { Module["printErr"]("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    return Module["dynCall_iiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    Module["dynCall_viiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };
Module.asmLibraryArg = { "abort": abort, "assert": assert, "nullFunc_iiiiiiii": nullFunc_iiiiiiii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_viiiiiii": nullFunc_viiiiiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_i": nullFunc_i, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_ii": nullFunc_ii, "nullFunc_viii": nullFunc_viii, "nullFunc_v": nullFunc_v, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "nullFunc_iii": nullFunc_iii, "nullFunc_viiii": nullFunc_viiii, "invoke_iiiiiiii": invoke_iiiiiiii, "invoke_iiii": invoke_iiii, "invoke_viiiiiii": invoke_viiiiiii, "invoke_viiiii": invoke_viiiii, "invoke_i": invoke_i, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_iiiiiii": invoke_iiiiiii, "invoke_ii": invoke_ii, "invoke_viii": invoke_viii, "invoke_v": invoke_v, "invoke_iiiii": invoke_iiiii, "invoke_viiiiii": invoke_viiiiii, "invoke_iii": invoke_iii, "invoke_viiii": invoke_viiii, "floatReadValueFromPointer": floatReadValueFromPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "throwInternalError": throwInternalError, "get_first_emval": get_first_emval, "getLiveInheritedInstances": getLiveInheritedInstances, "___assert_fail": ___assert_fail, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "ClassHandle": ClassHandle, "getShiftFromSize": getShiftFromSize, "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing, "_sbrk": _sbrk, "___cxa_begin_catch": ___cxa_begin_catch, "_emscripten_memcpy_big": _emscripten_memcpy_big, "runDestructor": runDestructor, "_sysconf": _sysconf, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "__embind_register_std_string": __embind_register_std_string, "init_RegisteredPointer": init_RegisteredPointer, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "flushPendingDeletes": flushPendingDeletes, "__embind_register_enum_value": __embind_register_enum_value, "makeClassHandle": makeClassHandle, "_write": _write, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "__embind_register_class_constructor": __embind_register_class_constructor, "init_ClassHandle": init_ClassHandle, "ClassHandle_clone": ClassHandle_clone, "_send": _send, "RegisteredClass": RegisteredClass, "___cxa_free_exception": ___cxa_free_exception, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "embind_init_charCodes": embind_init_charCodes, "___setErrNo": ___setErrNo, "__embind_register_bool": __embind_register_bool, "___resumeException": ___resumeException, "createNamedFunction": createNamedFunction, "__embind_register_emval": __embind_register_emval, "__emval_decref": __emval_decref, "_pthread_once": _pthread_once, "_printf": _printf, "init_embind": init_embind, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "heap32VectorToArray": heap32VectorToArray, "ClassHandle_delete": ClassHandle_delete, "_mkport": _mkport, "RegisteredPointer_destructor": RegisteredPointer_destructor, "ensureOverloadTable": ensureOverloadTable, "_time": _time, "_fprintf": _fprintf, "new_": new_, "downcastPointer": downcastPointer, "replacePublicSymbol": replacePublicSymbol, "__embind_register_class": __embind_register_class, "_llvm_pow_f64": _llvm_pow_f64, "ClassHandle_deleteLater": ClassHandle_deleteLater, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "ClassHandle_isDeleted": ClassHandle_isDeleted, "_vfprintf": _vfprintf, "__embind_register_integer": __embind_register_integer, "___cxa_allocate_exception": ___cxa_allocate_exception, "__emval_take_value": __emval_take_value, "_pwrite": _pwrite, "___cxa_end_catch": ___cxa_end_catch, "enumReadValueFromPointer": enumReadValueFromPointer, "_embind_repr": _embind_repr, "_pthread_getspecific": _pthread_getspecific, "__embind_register_class_function": __embind_register_class_function, "throwUnboundTypeError": throwUnboundTypeError, "craftInvokerFunction": craftInvokerFunction, "runDestructors": runDestructors, "requireRegisteredType": requireRegisteredType, "makeLegalFunctionName": makeLegalFunctionName, "_pthread_key_create": _pthread_key_create, "upcastPointer": upcastPointer, "init_emval": init_emval, "shallowCopyInternalPointer": shallowCopyInternalPointer, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "_fputc": _fputc, "_abort": _abort, "throwBindingError": throwBindingError, "getTypeName": getTypeName, "exposePublicSymbol": exposePublicSymbol, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "__embind_register_memory_view": __embind_register_memory_view, "getInheritedInstance": getInheritedInstance, "setDelayFunction": setDelayFunction, "___gxx_personality_v0": ___gxx_personality_v0, "extendError": extendError, "_fwrite": _fwrite, "__embind_register_void": __embind_register_void, "_fflush": _fflush, "__reallyNegative": __reallyNegative, "__emval_register": __emval_register, "__embind_register_std_wstring": __embind_register_std_wstring, "_fileno": _fileno, "__emval_incref": __emval_incref, "RegisteredPointer": RegisteredPointer, "readLatin1String": readLatin1String, "getBasestPointer": getBasestPointer, "getInheritedInstanceCount": getInheritedInstanceCount, "__embind_register_float": __embind_register_float, "integerReadValueFromPointer": integerReadValueFromPointer, "_emscripten_set_main_loop": _emscripten_set_main_loop, "___errno_location": ___errno_location, "_pthread_setspecific": _pthread_setspecific, "genericPointerToWireType": genericPointerToWireType, "registerType": registerType, "___cxa_throw": ___cxa_throw, "__embind_register_enum": __embind_register_enum, "count_emval_handles": count_emval_handles, "requireFunction": requireFunction, "__formatString": __formatString, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8, "_stderr": _stderr };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;
  var _stderr=env._stderr|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var nullFunc_iiiiiiii=env.nullFunc_iiiiiiii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_viiiiiii=env.nullFunc_viiiiiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_i=env.nullFunc_i;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_iiiiiii=env.nullFunc_iiiiiii;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_viii=env.nullFunc_viii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_iiiii=env.nullFunc_iiiii;
  var nullFunc_viiiiii=env.nullFunc_viiiiii;
  var nullFunc_iii=env.nullFunc_iii;
  var nullFunc_viiii=env.nullFunc_viiii;
  var invoke_iiiiiiii=env.invoke_iiiiiiii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_viiiiiii=env.invoke_viiiiiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_i=env.invoke_i;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_iiiiiii=env.invoke_iiiiiii;
  var invoke_ii=env.invoke_ii;
  var invoke_viii=env.invoke_viii;
  var invoke_v=env.invoke_v;
  var invoke_iiiii=env.invoke_iiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var invoke_iii=env.invoke_iii;
  var invoke_viiii=env.invoke_viiii;
  var floatReadValueFromPointer=env.floatReadValueFromPointer;
  var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
  var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
  var throwInternalError=env.throwInternalError;
  var get_first_emval=env.get_first_emval;
  var getLiveInheritedInstances=env.getLiveInheritedInstances;
  var ___assert_fail=env.___assert_fail;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var ClassHandle=env.ClassHandle;
  var getShiftFromSize=env.getShiftFromSize;
  var _emscripten_set_main_loop_timing=env._emscripten_set_main_loop_timing;
  var _sbrk=env._sbrk;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var runDestructor=env.runDestructor;
  var _sysconf=env._sysconf;
  var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
  var __embind_register_std_string=env.__embind_register_std_string;
  var init_RegisteredPointer=env.init_RegisteredPointer;
  var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
  var flushPendingDeletes=env.flushPendingDeletes;
  var __embind_register_enum_value=env.__embind_register_enum_value;
  var makeClassHandle=env.makeClassHandle;
  var _write=env._write;
  var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
  var __embind_register_class_constructor=env.__embind_register_class_constructor;
  var init_ClassHandle=env.init_ClassHandle;
  var ClassHandle_clone=env.ClassHandle_clone;
  var _send=env._send;
  var RegisteredClass=env.RegisteredClass;
  var ___cxa_free_exception=env.___cxa_free_exception;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var embind_init_charCodes=env.embind_init_charCodes;
  var ___setErrNo=env.___setErrNo;
  var __embind_register_bool=env.__embind_register_bool;
  var ___resumeException=env.___resumeException;
  var createNamedFunction=env.createNamedFunction;
  var __embind_register_emval=env.__embind_register_emval;
  var __emval_decref=env.__emval_decref;
  var _pthread_once=env._pthread_once;
  var _printf=env._printf;
  var init_embind=env.init_embind;
  var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
  var heap32VectorToArray=env.heap32VectorToArray;
  var ClassHandle_delete=env.ClassHandle_delete;
  var _mkport=env._mkport;
  var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
  var ensureOverloadTable=env.ensureOverloadTable;
  var _time=env._time;
  var _fprintf=env._fprintf;
  var new_=env.new_;
  var downcastPointer=env.downcastPointer;
  var replacePublicSymbol=env.replacePublicSymbol;
  var __embind_register_class=env.__embind_register_class;
  var _llvm_pow_f64=env._llvm_pow_f64;
  var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
  var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
  var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
  var _vfprintf=env._vfprintf;
  var __embind_register_integer=env.__embind_register_integer;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var __emval_take_value=env.__emval_take_value;
  var _pwrite=env._pwrite;
  var ___cxa_end_catch=env.___cxa_end_catch;
  var enumReadValueFromPointer=env.enumReadValueFromPointer;
  var _embind_repr=env._embind_repr;
  var _pthread_getspecific=env._pthread_getspecific;
  var __embind_register_class_function=env.__embind_register_class_function;
  var throwUnboundTypeError=env.throwUnboundTypeError;
  var craftInvokerFunction=env.craftInvokerFunction;
  var runDestructors=env.runDestructors;
  var requireRegisteredType=env.requireRegisteredType;
  var makeLegalFunctionName=env.makeLegalFunctionName;
  var _pthread_key_create=env._pthread_key_create;
  var upcastPointer=env.upcastPointer;
  var init_emval=env.init_emval;
  var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
  var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
  var _fputc=env._fputc;
  var _abort=env._abort;
  var throwBindingError=env.throwBindingError;
  var getTypeName=env.getTypeName;
  var exposePublicSymbol=env.exposePublicSymbol;
  var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
  var __embind_register_memory_view=env.__embind_register_memory_view;
  var getInheritedInstance=env.getInheritedInstance;
  var setDelayFunction=env.setDelayFunction;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var extendError=env.extendError;
  var _fwrite=env._fwrite;
  var __embind_register_void=env.__embind_register_void;
  var _fflush=env._fflush;
  var __reallyNegative=env.__reallyNegative;
  var __emval_register=env.__emval_register;
  var __embind_register_std_wstring=env.__embind_register_std_wstring;
  var _fileno=env._fileno;
  var __emval_incref=env.__emval_incref;
  var RegisteredPointer=env.RegisteredPointer;
  var readLatin1String=env.readLatin1String;
  var getBasestPointer=env.getBasestPointer;
  var getInheritedInstanceCount=env.getInheritedInstanceCount;
  var __embind_register_float=env.__embind_register_float;
  var integerReadValueFromPointer=env.integerReadValueFromPointer;
  var _emscripten_set_main_loop=env._emscripten_set_main_loop;
  var ___errno_location=env.___errno_location;
  var _pthread_setspecific=env._pthread_setspecific;
  var genericPointerToWireType=env.genericPointerToWireType;
  var registerType=env.registerType;
  var ___cxa_throw=env.___cxa_throw;
  var __embind_register_enum=env.__embind_register_enum;
  var count_emval_handles=env.count_emval_handles;
  var requireFunction=env.requireFunction;
  var __formatString=env.__formatString;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS
function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
if ((STACKTOP|0) >= (STACK_MAX|0)) abort();

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}
function copyTempFloat(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
  HEAP8[tempDoublePtr+4>>0] = HEAP8[ptr+4>>0];
  HEAP8[tempDoublePtr+5>>0] = HEAP8[ptr+5>>0];
  HEAP8[tempDoublePtr+6>>0] = HEAP8[ptr+6>>0];
  HEAP8[tempDoublePtr+7>>0] = HEAP8[ptr+7>>0];
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function __ZN37EmscriptenBindingInitializer_BillTypeC2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = sp + 4|0;
 $0 = $this;
 __ZN10emscripten5enum_I8BillTypeEC2EPKc($1,184);
 $2 = (__ZN10emscripten5enum_I8BillTypeE5valueEPKcS1_($1,200,0)|0);
 $3 = (__ZN10emscripten5enum_I8BillTypeE5valueEPKcS1_($2,208,1)|0);
 $4 = (__ZN10emscripten5enum_I8BillTypeE5valueEPKcS1_($3,216,2)|0);
 (__ZN10emscripten5enum_I8BillTypeE5valueEPKcS1_($4,224,3)|0);
 STACKTOP = sp;return;
}
function __ZN33EmscriptenBindingInitializer_BillC2Ev($this) {
 $this = $this|0;
 var $$index1 = 0, $$index13 = 0, $$index15 = 0, $$index20 = 0, $$index6 = 0, $$index8 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $8 = 0, $9 = 0, $_getActualType$i = 0, $args$i = 0, $args$i$i = 0, $args$i2 = 0, $args$i5 = 0, $destructor$i = 0, $downcast$i = 0, $invoke$i$i = 0, $invoker$i = 0, $invoker$i1 = 0, $invoker$i4 = 0, $memberFunction$i$field = 0, $memberFunction$i$field3 = 0, $memberFunction$i$index2 = 0, $memberFunction$i3$field = 0, $memberFunction$i3$field10 = 0, $memberFunction$i3$index9 = 0;
 var $memberFunction$i6$field = 0, $memberFunction$i6$field17 = 0, $memberFunction$i6$index16 = 0, $upcast$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 120|0;
 $args$i5 = sp + 161|0;
 $3 = sp + 8|0;
 $6 = sp + 152|0;
 $args$i2 = sp + 163|0;
 $7 = sp;
 $10 = sp + 136|0;
 $args$i = sp + 165|0;
 $11 = sp + 16|0;
 $args$i$i = sp + 164|0;
 $18 = sp + 160|0;
 $19 = sp + 64|0;
 $20 = sp + 72|0;
 $21 = sp + 80|0;
 $22 = sp + 162|0;
 $17 = $this;
 $15 = $18;
 $16 = 232;
 __ZN10emscripten8internal11NoBaseClass6verifyI4BillEEvv();
 $_getActualType$i = 39;
 $23 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI4BillEEPFvvEv()|0);
 $upcast$i = $23;
 $24 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI4BillEEPFvvEv()|0);
 $downcast$i = $24;
 $destructor$i = 40;
 $25 = (__ZN10emscripten8internal6TypeIDI4BillE3getEv()|0);
 $26 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI4BillEEE3getEv()|0);
 $27 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK4BillEEE3getEv()|0);
 $28 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $29 = $_getActualType$i;
 $30 = (__ZN10emscripten8internal12getSignatureIPKvJP4BillEEEPKcPFT_DpT0_E($29)|0);
 $31 = $_getActualType$i;
 $32 = $upcast$i;
 $33 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($32)|0);
 $34 = $upcast$i;
 $35 = $downcast$i;
 $36 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($35)|0);
 $37 = $downcast$i;
 $38 = $16;
 $39 = $destructor$i;
 $40 = (__ZN10emscripten8internal12getSignatureIvJP4BillEEEPKcPFT_DpT0_E($39)|0);
 $41 = $destructor$i;
 __embind_register_class(($25|0),($26|0),($27|0),($28|0),($30|0),($31|0),($33|0),($34|0),($36|0),($37|0),($38|0),($40|0),($41|0));
 $14 = $18;
 $42 = $14;
 $12 = $42;
 $13 = 41;
 $43 = $12;
 $invoke$i$i = 42;
 $44 = (__ZN10emscripten8internal6TypeIDI4BillE3getEv()|0);
 $45 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP4BillOiS7_S7_S7_O8BillTypeONSt3__112basic_stringIcNSA_11char_traitsIcEENSA_9allocatorIcEEEEEE8getCountEv($args$i$i)|0);
 $46 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP4BillOiS7_S7_S7_O8BillTypeONSt3__112basic_stringIcNSA_11char_traitsIcEENSA_9allocatorIcEEEEEE8getTypesEv($args$i$i)|0);
 $47 = $invoke$i$i;
 $48 = (__ZN10emscripten8internal12getSignatureIP4BillJPFS3_OiS4_S4_S4_O8BillTypeONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEiiiiS5_PNS0_11BindingTypeISD_EUt_EEEEPKcPFT_DpT0_E($47)|0);
 $49 = $invoke$i$i;
 $50 = $13;
 __embind_register_class_constructor(($44|0),($45|0),($46|0),($48|0),($49|0),($50|0));
 HEAP32[$19>>2] = (43);
 $$index1 = ((($19)) + 4|0);
 HEAP32[$$index1>>2] = 0;
 ;HEAP8[$11>>0]=HEAP8[$19>>0]|0;HEAP8[$11+1>>0]=HEAP8[$19+1>>0]|0;HEAP8[$11+2>>0]=HEAP8[$19+2>>0]|0;HEAP8[$11+3>>0]=HEAP8[$19+3>>0]|0;HEAP8[$11+4>>0]=HEAP8[$19+4>>0]|0;HEAP8[$11+5>>0]=HEAP8[$19+5>>0]|0;HEAP8[$11+6>>0]=HEAP8[$19+6>>0]|0;HEAP8[$11+7>>0]=HEAP8[$19+7>>0]|0;
 $memberFunction$i$field = HEAP32[$11>>2]|0;
 $memberFunction$i$index2 = ((($11)) + 4|0);
 $memberFunction$i$field3 = HEAP32[$memberFunction$i$index2>>2]|0;
 $8 = $43;
 $9 = 240;
 HEAP32[$10>>2] = $memberFunction$i$field;
 $$index6 = ((($10)) + 4|0);
 HEAP32[$$index6>>2] = $memberFunction$i$field3;
 $51 = $8;
 $invoker$i = 44;
 $52 = (__ZN10emscripten8internal6TypeIDI4BillE3getEv()|0);
 $53 = $9;
 $54 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI4BillEEEE8getCountEv($args$i)|0);
 $55 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($args$i)|0);
 $56 = $invoker$i;
 $57 = (__ZN10emscripten8internal12getSignatureIiJRKM4BillFivEPS2_EEEPKcPFT_DpT0_E($56)|0);
 $58 = $invoker$i;
 $59 = (__ZN10emscripten8internal10getContextIM4BillFivEEEPT_RKS5_($10)|0);
 __embind_register_class_function(($52|0),($53|0),($54|0),($55|0),($57|0),($58|0),($59|0),0);
 HEAP32[$20>>2] = (45);
 $$index8 = ((($20)) + 4|0);
 HEAP32[$$index8>>2] = 0;
 ;HEAP8[$7>>0]=HEAP8[$20>>0]|0;HEAP8[$7+1>>0]=HEAP8[$20+1>>0]|0;HEAP8[$7+2>>0]=HEAP8[$20+2>>0]|0;HEAP8[$7+3>>0]=HEAP8[$20+3>>0]|0;HEAP8[$7+4>>0]=HEAP8[$20+4>>0]|0;HEAP8[$7+5>>0]=HEAP8[$20+5>>0]|0;HEAP8[$7+6>>0]=HEAP8[$20+6>>0]|0;HEAP8[$7+7>>0]=HEAP8[$20+7>>0]|0;
 $memberFunction$i3$field = HEAP32[$7>>2]|0;
 $memberFunction$i3$index9 = ((($7)) + 4|0);
 $memberFunction$i3$field10 = HEAP32[$memberFunction$i3$index9>>2]|0;
 $4 = $51;
 $5 = 256;
 HEAP32[$6>>2] = $memberFunction$i3$field;
 $$index13 = ((($6)) + 4|0);
 HEAP32[$$index13>>2] = $memberFunction$i3$field10;
 $60 = $4;
 $invoker$i1 = 46;
 $61 = (__ZN10emscripten8internal6TypeIDI4BillE3getEv()|0);
 $62 = $5;
 $63 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEE8getCountEv($args$i2)|0);
 $64 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($args$i2)|0);
 $65 = $invoker$i1;
 $66 = (__ZN10emscripten8internal12getSignatureI8BillTypeJRKM4BillFS2_vEPS3_EEEPKcPFT_DpT0_E($65)|0);
 $67 = $invoker$i1;
 $68 = (__ZN10emscripten8internal10getContextIM4BillF8BillTypevEEEPT_RKS6_($6)|0);
 __embind_register_class_function(($61|0),($62|0),($63|0),($64|0),($66|0),($67|0),($68|0),0);
 HEAP32[$21>>2] = (47);
 $$index15 = ((($21)) + 4|0);
 HEAP32[$$index15>>2] = 0;
 ;HEAP8[$3>>0]=HEAP8[$21>>0]|0;HEAP8[$3+1>>0]=HEAP8[$21+1>>0]|0;HEAP8[$3+2>>0]=HEAP8[$21+2>>0]|0;HEAP8[$3+3>>0]=HEAP8[$21+3>>0]|0;HEAP8[$3+4>>0]=HEAP8[$21+4>>0]|0;HEAP8[$3+5>>0]=HEAP8[$21+5>>0]|0;HEAP8[$3+6>>0]=HEAP8[$21+6>>0]|0;HEAP8[$3+7>>0]=HEAP8[$21+7>>0]|0;
 $memberFunction$i6$field = HEAP32[$3>>2]|0;
 $memberFunction$i6$index16 = ((($3)) + 4|0);
 $memberFunction$i6$field17 = HEAP32[$memberFunction$i6$index16>>2]|0;
 $0 = $60;
 $1 = 264;
 HEAP32[$2>>2] = $memberFunction$i6$field;
 $$index20 = ((($2)) + 4|0);
 HEAP32[$$index20>>2] = $memberFunction$i6$field17;
 $invoker$i4 = 48;
 $69 = (__ZN10emscripten8internal6TypeIDI4BillE3getEv()|0);
 $70 = $1;
 $71 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI4BillEEEE8getCountEv($args$i5)|0);
 $72 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($args$i5)|0);
 $73 = $invoker$i4;
 $74 = (__ZN10emscripten8internal12getSignatureIvJRKM4BillFvvEPS2_EEEPKcPFT_DpT0_E($73)|0);
 $75 = $invoker$i4;
 $76 = (__ZN10emscripten8internal10getContextIM4BillFvvEEEPT_RKS5_($2)|0);
 __embind_register_class_function(($69|0),($70|0),($71|0),($72|0),($74|0),($75|0),($76|0),0);
 __ZN10emscripten15register_vectorIP4BillEENS_6class_INSt3__16vectorIT_NS4_9allocatorIS6_EEEENS_8internal11NoBaseClassEEEPKc($22,272);
 STACKTOP = sp;return;
}
function __ZN13CredictCardHN11getDisCountEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0.0, $101 = 0.0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0.0;
 var $116 = 0.0, $117 = 0.0, $118 = 0, $119 = 0.0, $12 = 0, $120 = 0.0, $121 = 0.0, $122 = 0.0, $123 = 0, $124 = 0, $125 = 0, $126 = 0.0, $127 = 0.0, $128 = 0.0, $129 = 0, $13 = 0, $130 = 0.0, $131 = 0.0, $132 = 0.0, $133 = 0.0;
 var $134 = 0.0, $135 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0.0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0.0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0.0, $81 = 0, $82 = 0.0, $83 = 0.0, $84 = 0.0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0, $94 = 0, $95 = 0.0, $96 = 0, $97 = 0.0, $98 = 0.0, $99 = 0.0, $cnt888 = 0, $disCount = 0.0, $i = 0, $idx = 0;
 var $j = 0, $j1 = 0, $j3 = 0, $list888 = 0, $maxEach = 0.0, $maxTotal = 0.0, $n = 0.0, $n2 = 0.0, $n4 = 0.0, $normalSum = 0, $or$cond = 0, $subtotal = 0.0, $sum888DisCount = 0.0, $th = 0, $tmpList = 0, $val = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $6 = sp + 192|0;
 $9 = sp + 180|0;
 $tmpList = sp + 152|0;
 $list888 = sp;
 $13 = $this;
 $17 = $13;
 $12 = $tmpList;
 $18 = $12;
 $11 = $18;
 $19 = $11;
 $10 = $19;
 HEAP32[$19>>2] = 0;
 $20 = ((($19)) + 4|0);
 HEAP32[$20>>2] = 0;
 $21 = ((($19)) + 8|0);
 $8 = $21;
 HEAP32[$9>>2] = 0;
 $22 = $8;
 $7 = $9;
 $23 = $7;
 $24 = HEAP32[$23>>2]|0;
 $5 = $22;
 HEAP32[$6>>2] = $24;
 $25 = $5;
 $4 = $25;
 $3 = $6;
 $26 = $3;
 $27 = HEAP32[$26>>2]|0;
 HEAP32[$25>>2] = $27;
 __THREW__ = 0;
 invoke_vii(49,($17|0),($tmpList|0));
 $28 = __THREW__; __THREW__ = 0;
 $29 = $28&1;
 if ($29) {
  $76 = ___cxa_find_matching_catch()|0;
  $77 = tempRet0;
  $14 = $76;
  $15 = $77;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
  $78 = $14;
  $79 = $15;
  ___resumeException($78|0);
  // unreachable;
 }
 $normalSum = 0;
 $cnt888 = 5;
 $sum888DisCount = 0.0;
 $idx = 0;
 $th = 12000;
 $i = 0;
 while(1) {
  $30 = $i;
  $2 = $tmpList;
  $31 = $2;
  $32 = ((($31)) + 4|0);
  $33 = HEAP32[$32>>2]|0;
  $34 = HEAP32[$31>>2]|0;
  $35 = $33;
  $36 = $34;
  $37 = (($35) - ($36))|0;
  $38 = (($37|0) / 4)&-1;
  $39 = ($30>>>0)<($38>>>0);
  if (!($39)) {
   label = 32;
   break;
  }
  $40 = $i;
  $0 = $tmpList;
  $1 = $40;
  $41 = $0;
  $42 = $1;
  $43 = HEAP32[$41>>2]|0;
  $44 = (($43) + ($42<<2)|0);
  $45 = HEAP32[$44>>2]|0;
  __THREW__ = 0;
  $46 = (invoke_ii(43,($45|0))|0);
  $47 = __THREW__; __THREW__ = 0;
  $48 = $47&1;
  if ($48) {
   label = 10;
   break;
  }
  $val = $46;
  $49 = $val;
  $50 = $normalSum;
  $51 = (($50) + ($49))|0;
  $normalSum = $51;
  $maxEach = 100.0;
  $maxTotal = 500.0;
  $52 = $val;
  $53 = ($52|0)>=(888);
  $54 = $val;
  $55 = ($54|0)<(12000);
  $or$cond = $53 & $55;
  $56 = $val;
  do {
   if ($or$cond) {
    $57 = (+($56|0));
    $58 = $idx;
    $59 = (($list888) + ($58<<3)|0);
    HEAPF64[$59>>3] = $57;
    $60 = $idx;
    $61 = (($60) + 1)|0;
    $idx = $61;
    $62 = $idx;
    $63 = ($62|0)==(5);
    if ($63) {
     $idx = 0;
     $n = 0.0;
     $j = 0;
     while(1) {
      $64 = $j;
      $65 = ($64>>>0)<(5);
      if (!($65)) {
       break;
      }
      $66 = $j;
      $67 = (($list888) + ($66<<3)|0);
      $68 = +HEAPF64[$67>>3];
      $69 = 0.0070000000000000001 * $68;
      $70 = $n;
      $71 = $70 + $69;
      $n = $71;
      $72 = $j;
      $73 = (($list888) + ($72<<3)|0);
      HEAPF64[$73>>3] = 0.0;
      $74 = $j;
      $75 = (($74) + 1)|0;
      $j = $75;
     }
     $80 = $n;
     $81 = $80 > 100.0;
     if ($81) {
      $n = 100.0;
     }
     $82 = $n;
     $83 = $sum888DisCount;
     $84 = $83 + $82;
     $sum888DisCount = $84;
     break;
    }
    $subtotal = 0.0;
    $j1 = 0;
    while(1) {
     $85 = $j1;
     $86 = $idx;
     $87 = ($85>>>0)<($86>>>0);
     if (!($87)) {
      break;
     }
     $88 = $j1;
     $89 = (($list888) + ($88<<3)|0);
     $90 = +HEAPF64[$89>>3];
     $91 = $subtotal;
     $92 = $91 + $90;
     $subtotal = $92;
     $93 = $j1;
     $94 = (($93) + 1)|0;
     $j1 = $94;
    }
    $n2 = 0.0;
    $95 = $subtotal;
    $96 = $95 >= 12000.0;
    if ($96) {
     $97 = $subtotal;
     $98 = 0.0070000000000000001 * $97;
     $99 = $n2;
     $100 = $99 + $98;
     $n2 = $100;
     $101 = $n2;
     $102 = $101 > 100.0;
     if ($102) {
      $n2 = 100.0;
     }
     $j3 = 0;
     while(1) {
      $103 = $j3;
      $104 = $idx;
      $105 = ($103>>>0)<($104>>>0);
      if (!($105)) {
       break;
      }
      $106 = $j3;
      $107 = (($list888) + ($106<<3)|0);
      HEAPF64[$107>>3] = 0.0;
      $108 = $j3;
      $109 = (($108) + 1)|0;
      $j3 = $109;
     }
     $idx = 0;
    }
    $110 = $n2;
    $111 = $sum888DisCount;
    $112 = $111 + $110;
    $sum888DisCount = $112;
   } else {
    $113 = ($56|0)>=(12000);
    if ($113) {
     $114 = $val;
     $115 = (+($114|0));
     $116 = 0.0070000000000000001 * $115;
     $n4 = $116;
     $117 = $n4;
     $118 = $117 > 100.0;
     if ($118) {
      $n4 = 100.0;
     }
     $119 = $n4;
     $120 = $sum888DisCount;
     $121 = $120 + $119;
     $sum888DisCount = $121;
    }
   }
  } while(0);
  $122 = $sum888DisCount;
  $123 = $122 > 500.0;
  if ($123) {
   $sum888DisCount = 500.0;
  }
  $124 = $i;
  $125 = (($124) + 1)|0;
  $i = $125;
 }
 if ((label|0) == 10) {
  $76 = ___cxa_find_matching_catch()|0;
  $77 = tempRet0;
  $14 = $76;
  $15 = $77;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
  $78 = $14;
  $79 = $15;
  ___resumeException($78|0);
  // unreachable;
 }
 else if ((label|0) == 32) {
  $disCount = 0.0;
  $126 = $sum888DisCount;
  $127 = $disCount;
  $128 = $127 + $126;
  $disCount = $128;
  $129 = $normalSum;
  $130 = (+($129|0));
  $131 = 0.0080000000000000002 * $130;
  $132 = $disCount;
  $133 = $132 + $131;
  $disCount = $133;
  $134 = $disCount;
  $135 = (~~(($134)));
  $16 = 1;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
  STACKTOP = sp;return ($135|0);
 }
 return (0)|0;
}
function __ZN13CredictCardYS9_check699Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $8 = 0, $9 = 0, $cnt = 0, $i = 0, $tmpList = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 60|0;
 $11 = sp + 48|0;
 $tmpList = sp + 16|0;
 $15 = $this;
 $19 = $15;
 $14 = $tmpList;
 $20 = $14;
 $13 = $20;
 $21 = $13;
 $12 = $21;
 HEAP32[$21>>2] = 0;
 $22 = ((($21)) + 4|0);
 HEAP32[$22>>2] = 0;
 $23 = ((($21)) + 8|0);
 $10 = $23;
 HEAP32[$11>>2] = 0;
 $24 = $10;
 $9 = $11;
 $25 = $9;
 $26 = HEAP32[$25>>2]|0;
 $7 = $24;
 HEAP32[$8>>2] = $26;
 $27 = $7;
 $6 = $27;
 $5 = $8;
 $28 = $5;
 $29 = HEAP32[$28>>2]|0;
 HEAP32[$27>>2] = $29;
 __THREW__ = 0;
 invoke_vii(49,($19|0),($tmpList|0));
 $30 = __THREW__; __THREW__ = 0;
 $31 = $30&1;
 L1: do {
  if (!($31)) {
   $cnt = 0;
   $i = 0;
   while(1) {
    $32 = $i;
    $4 = $tmpList;
    $33 = $4;
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = HEAP32[$33>>2]|0;
    $37 = $35;
    $38 = $36;
    $39 = (($37) - ($38))|0;
    $40 = (($39|0) / 4)&-1;
    $41 = ($32>>>0)<($40>>>0);
    if (!($41)) {
     break;
    }
    $42 = $i;
    $2 = $tmpList;
    $3 = $42;
    $43 = $2;
    $44 = $3;
    $45 = HEAP32[$43>>2]|0;
    $46 = (($45) + ($44<<2)|0);
    $47 = HEAP32[$46>>2]|0;
    __THREW__ = 0;
    $48 = (invoke_ii(43,($47|0))|0);
    $49 = __THREW__; __THREW__ = 0;
    $50 = $49&1;
    if ($50) {
     break L1;
    }
    $51 = ($48|0)>=(699);
    if ($51) {
     $52 = $i;
     $0 = $tmpList;
     $1 = $52;
     $53 = $0;
     $54 = $1;
     $55 = HEAP32[$53>>2]|0;
     $56 = (($55) + ($54<<2)|0);
     $57 = HEAP32[$56>>2]|0;
     __THREW__ = 0;
     $58 = (invoke_ii(45,($57|0))|0);
     $59 = __THREW__; __THREW__ = 0;
     $60 = $59&1;
     if ($60) {
      break L1;
     }
     $61 = ($58|0)!=(1);
     if ($61) {
      $62 = $cnt;
      $63 = (($62) + 1)|0;
      $cnt = $63;
     }
    }
    $68 = $i;
    $69 = (($68) + 1)|0;
    $i = $69;
   }
   $70 = $cnt;
   $18 = 1;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
   STACKTOP = sp;return ($70|0);
  }
 } while(0);
 $64 = ___cxa_find_matching_catch()|0;
 $65 = tempRet0;
 $16 = $64;
 $17 = $65;
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
 $66 = $16;
 $67 = $17;
 ___resumeException($66|0);
 // unreachable;
 return (0)|0;
}
function __ZN13CredictCardYS11getDisCountEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0.0, $102 = 0.0, $103 = 0.0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0.0, $108 = 0.0, $109 = 0, $11 = 0, $110 = 0.0, $111 = 0.0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0.0, $144 = 0.0, $145 = 0.0, $146 = 0, $147 = 0, $148 = 0.0, $149 = 0.0, $15 = 0, $150 = 0.0, $151 = 0.0;
 var $152 = 0.0, $153 = 0.0, $154 = 0.0, $155 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cnt699 = 0, $i = 0, $i1 = 0, $icashDisCount = 0.0;
 var $netDisCount = 0.0, $normalDisCount = 0.0, $tmpList = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $17 = sp + 88|0;
 $20 = sp + 56|0;
 $tmpList = sp + 36|0;
 $24 = $this;
 $28 = $24;
 $23 = $tmpList;
 $29 = $23;
 $22 = $29;
 $30 = $22;
 $21 = $30;
 HEAP32[$30>>2] = 0;
 $31 = ((($30)) + 4|0);
 HEAP32[$31>>2] = 0;
 $32 = ((($30)) + 8|0);
 $19 = $32;
 HEAP32[$20>>2] = 0;
 $33 = $19;
 $18 = $20;
 $34 = $18;
 $35 = HEAP32[$34>>2]|0;
 $16 = $33;
 HEAP32[$17>>2] = $35;
 $36 = $16;
 $15 = $36;
 $14 = $17;
 $37 = $14;
 $38 = HEAP32[$37>>2]|0;
 HEAP32[$36>>2] = $38;
 __THREW__ = 0;
 invoke_vii(49,($28|0),($tmpList|0));
 $39 = __THREW__; __THREW__ = 0;
 $40 = $39&1;
 L1: do {
  if (!($40)) {
   __THREW__ = 0;
   $41 = (invoke_ii(50,($28|0))|0);
   $42 = __THREW__; __THREW__ = 0;
   $43 = $42&1;
   if (!($43)) {
    $cnt699 = $41;
    $icashDisCount = 0.0;
    $netDisCount = 0.0;
    $44 = $cnt699;
    $45 = ($44|0)>=(5);
    if ($45) {
     $i = 0;
     while(1) {
      $46 = $i;
      $13 = $tmpList;
      $47 = $13;
      $48 = ((($47)) + 4|0);
      $49 = HEAP32[$48>>2]|0;
      $50 = HEAP32[$47>>2]|0;
      $51 = $49;
      $52 = $50;
      $53 = (($51) - ($52))|0;
      $54 = (($53|0) / 4)&-1;
      $55 = ($46>>>0)<($54>>>0);
      if (!($55)) {
       break;
      }
      $56 = $i;
      $11 = $tmpList;
      $12 = $56;
      $57 = $11;
      $58 = $12;
      $59 = HEAP32[$57>>2]|0;
      $60 = (($59) + ($58<<2)|0);
      $61 = HEAP32[$60>>2]|0;
      __THREW__ = 0;
      $62 = (invoke_ii(45,($61|0))|0);
      $63 = __THREW__; __THREW__ = 0;
      $64 = $63&1;
      if ($64) {
       break L1;
      }
      $65 = ($62|0)==(1);
      if ($65) {
       $66 = $i;
       $7 = $tmpList;
       $8 = $66;
       $67 = $7;
       $68 = $8;
       $69 = HEAP32[$67>>2]|0;
       $70 = (($69) + ($68<<2)|0);
       $71 = HEAP32[$70>>2]|0;
       __THREW__ = 0;
       $72 = (invoke_ii(43,($71|0))|0);
       $73 = __THREW__; __THREW__ = 0;
       $74 = $73&1;
       if ($74) {
        break L1;
       }
       $75 = (+($72|0));
       $76 = $icashDisCount;
       $77 = $76 + $75;
       $icashDisCount = $77;
      }
      $82 = $i;
      $2 = $tmpList;
      $3 = $82;
      $83 = $2;
      $84 = $3;
      $85 = HEAP32[$83>>2]|0;
      $86 = (($85) + ($84<<2)|0);
      $87 = HEAP32[$86>>2]|0;
      __THREW__ = 0;
      $88 = (invoke_ii(45,($87|0))|0);
      $89 = __THREW__; __THREW__ = 0;
      $90 = $89&1;
      if ($90) {
       break L1;
      }
      $91 = ($88|0)==(2);
      if ($91) {
       $92 = $i;
       $0 = $tmpList;
       $1 = $92;
       $93 = $0;
       $94 = $1;
       $95 = HEAP32[$93>>2]|0;
       $96 = (($95) + ($94<<2)|0);
       $97 = HEAP32[$96>>2]|0;
       __THREW__ = 0;
       $98 = (invoke_ii(43,($97|0))|0);
       $99 = __THREW__; __THREW__ = 0;
       $100 = $99&1;
       if ($100) {
        break L1;
       }
       $101 = (+($98|0));
       $102 = $netDisCount;
       $103 = $102 + $101;
       $netDisCount = $103;
      }
      $104 = $i;
      $105 = (($104) + 1)|0;
      $i = $105;
     }
     $106 = $icashDisCount;
     $107 = 0.050000000000000003 * $106;
     $icashDisCount = $107;
     $108 = $icashDisCount;
     $109 = $108 > 100.0;
     if ($109) {
      $icashDisCount = 100.0;
     }
     $110 = $netDisCount;
     $111 = 0.050000000000000003 * $110;
     $netDisCount = $111;
     $112 = $netDisCount;
     $113 = $112 > 300.0;
     if ($113) {
      $netDisCount = 300.0;
     }
    }
    $normalDisCount = 0.0;
    $i1 = 0;
    while(1) {
     $114 = $i1;
     $4 = $tmpList;
     $115 = $4;
     $116 = ((($115)) + 4|0);
     $117 = HEAP32[$116>>2]|0;
     $118 = HEAP32[$115>>2]|0;
     $119 = $117;
     $120 = $118;
     $121 = (($119) - ($120))|0;
     $122 = (($121|0) / 4)&-1;
     $123 = ($114>>>0)<($122>>>0);
     if (!($123)) {
      break;
     }
     $124 = $i1;
     $5 = $tmpList;
     $6 = $124;
     $125 = $5;
     $126 = $6;
     $127 = HEAP32[$125>>2]|0;
     $128 = (($127) + ($126<<2)|0);
     $129 = HEAP32[$128>>2]|0;
     __THREW__ = 0;
     $130 = (invoke_ii(45,($129|0))|0);
     $131 = __THREW__; __THREW__ = 0;
     $132 = $131&1;
     if ($132) {
      break L1;
     }
     $133 = ($130|0)==(3);
     if (!($133)) {
      $134 = $i1;
      $9 = $tmpList;
      $10 = $134;
      $135 = $9;
      $136 = $10;
      $137 = HEAP32[$135>>2]|0;
      $138 = (($137) + ($136<<2)|0);
      $139 = HEAP32[$138>>2]|0;
      __THREW__ = 0;
      $140 = (invoke_ii(43,($139|0))|0);
      $141 = __THREW__; __THREW__ = 0;
      $142 = $141&1;
      if ($142) {
       break L1;
      }
      $143 = (+($140|0));
      $144 = $normalDisCount;
      $145 = $144 + $143;
      $normalDisCount = $145;
     }
     $146 = $i1;
     $147 = (($146) + 1)|0;
     $i1 = $147;
    }
    $148 = $normalDisCount;
    $149 = 0.0070000000000000001 * $148;
    $normalDisCount = $149;
    $150 = $normalDisCount;
    $151 = $icashDisCount;
    $152 = $150 + $151;
    $153 = $netDisCount;
    $154 = $152 + $153;
    $155 = (~~(($154)));
    $27 = 1;
    __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
    STACKTOP = sp;return ($155|0);
   }
  }
 } while(0);
 $78 = ___cxa_find_matching_catch()|0;
 $79 = tempRet0;
 $25 = $78;
 $26 = $79;
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
 $80 = $25;
 $81 = $26;
 ___resumeException($80|0);
 // unreachable;
 return (0)|0;
}
function __ZN18CredictCardHNICash11getDisCountEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0, $69 = 0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0, $8 = 0, $9 = 0, $i = 0, $sum = 0.0, $tmpList = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 64|0;
 $11 = sp + 52|0;
 $tmpList = sp + 24|0;
 $15 = $this;
 $19 = $15;
 $14 = $tmpList;
 $20 = $14;
 $13 = $20;
 $21 = $13;
 $12 = $21;
 HEAP32[$21>>2] = 0;
 $22 = ((($21)) + 4|0);
 HEAP32[$22>>2] = 0;
 $23 = ((($21)) + 8|0);
 $10 = $23;
 HEAP32[$11>>2] = 0;
 $24 = $10;
 $9 = $11;
 $25 = $9;
 $26 = HEAP32[$25>>2]|0;
 $7 = $24;
 HEAP32[$8>>2] = $26;
 $27 = $7;
 $6 = $27;
 $5 = $8;
 $28 = $5;
 $29 = HEAP32[$28>>2]|0;
 HEAP32[$27>>2] = $29;
 __THREW__ = 0;
 invoke_vii(49,($19|0),($tmpList|0));
 $30 = __THREW__; __THREW__ = 0;
 $31 = $30&1;
 L1: do {
  if (!($31)) {
   $sum = 0.0;
   $i = 0;
   while(1) {
    $32 = $i;
    $4 = $tmpList;
    $33 = $4;
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = HEAP32[$33>>2]|0;
    $37 = $35;
    $38 = $36;
    $39 = (($37) - ($38))|0;
    $40 = (($39|0) / 4)&-1;
    $41 = ($32>>>0)<($40>>>0);
    if (!($41)) {
     break;
    }
    $42 = $i;
    $2 = $tmpList;
    $3 = $42;
    $43 = $2;
    $44 = $3;
    $45 = HEAP32[$43>>2]|0;
    $46 = (($45) + ($44<<2)|0);
    $47 = HEAP32[$46>>2]|0;
    __THREW__ = 0;
    $48 = (invoke_ii(45,($47|0))|0);
    $49 = __THREW__; __THREW__ = 0;
    $50 = $49&1;
    if ($50) {
     break L1;
    }
    $51 = ($48|0)!=(2);
    if (!($51)) {
     $56 = $i;
     $0 = $tmpList;
     $1 = $56;
     $57 = $0;
     $58 = $1;
     $59 = HEAP32[$57>>2]|0;
     $60 = (($59) + ($58<<2)|0);
     $61 = HEAP32[$60>>2]|0;
     __THREW__ = 0;
     $62 = (invoke_ii(43,($61|0))|0);
     $63 = __THREW__; __THREW__ = 0;
     $64 = $63&1;
     if ($64) {
      break L1;
     }
     $65 = (+($62|0));
     $66 = $sum;
     $67 = $66 + $65;
     $sum = $67;
    }
    $68 = $i;
    $69 = (($68) + 1)|0;
    $i = $69;
   }
   $70 = $sum;
   $71 = 0.025000000000000001 * $70;
   $72 = (~~(($71)));
   $18 = 1;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
   STACKTOP = sp;return ($72|0);
  }
 } while(0);
 $52 = ___cxa_find_matching_catch()|0;
 $53 = tempRet0;
 $16 = $52;
 $17 = $53;
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($tmpList);
 $54 = $16;
 $55 = $17;
 ___resumeException($54|0);
 // unreachable;
 return (0)|0;
}
function __ZN44EmscriptenBindingInitializer_CredictCardBaseC2Ev($this) {
 $this = $this|0;
 var $$index1 = 0, $$index13 = 0, $$index15 = 0, $$index20 = 0, $$index22 = 0, $$index27 = 0, $$index29 = 0, $$index34 = 0, $$index36 = 0, $$index41 = 0, $$index43 = 0, $$index48 = 0, $$index50 = 0, $$index55 = 0, $$index57 = 0, $$index6 = 0, $$index62 = 0, $$index64 = 0, $$index69 = 0, $$index8 = 0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $_getActualType$i = 0;
 var $_getActualType$i22 = 0, $_getActualType$i31 = 0, $_getActualType$i40 = 0, $args$i = 0, $args$i$i = 0, $args$i$i26 = 0, $args$i$i35 = 0, $args$i$i44 = 0, $args$i11 = 0, $args$i14 = 0, $args$i17 = 0, $args$i2 = 0, $args$i20 = 0, $args$i29 = 0, $args$i38 = 0, $args$i5 = 0, $args$i8 = 0, $destructor$i = 0, $destructor$i25 = 0, $destructor$i34 = 0;
 var $destructor$i43 = 0, $downcast$i = 0, $downcast$i24 = 0, $downcast$i33 = 0, $downcast$i42 = 0, $invoke$i$i = 0, $invoke$i$i27 = 0, $invoke$i$i36 = 0, $invoke$i$i45 = 0, $invoker$i = 0, $invoker$i1 = 0, $invoker$i10 = 0, $invoker$i13 = 0, $invoker$i16 = 0, $invoker$i19 = 0, $invoker$i28 = 0, $invoker$i37 = 0, $invoker$i4 = 0, $invoker$i7 = 0, $memberFunction$i$field = 0;
 var $memberFunction$i$field3 = 0, $memberFunction$i$index2 = 0, $memberFunction$i12$field = 0, $memberFunction$i12$field31 = 0, $memberFunction$i12$index30 = 0, $memberFunction$i15$field = 0, $memberFunction$i15$field38 = 0, $memberFunction$i15$index37 = 0, $memberFunction$i18$field = 0, $memberFunction$i18$field45 = 0, $memberFunction$i18$index44 = 0, $memberFunction$i21$field = 0, $memberFunction$i21$field52 = 0, $memberFunction$i21$index51 = 0, $memberFunction$i3$field = 0, $memberFunction$i3$field10 = 0, $memberFunction$i3$index9 = 0, $memberFunction$i30$field = 0, $memberFunction$i30$field59 = 0, $memberFunction$i30$index58 = 0;
 var $memberFunction$i39$field = 0, $memberFunction$i39$field66 = 0, $memberFunction$i39$index65 = 0, $memberFunction$i6$field = 0, $memberFunction$i6$field17 = 0, $memberFunction$i6$index16 = 0, $memberFunction$i9$field = 0, $memberFunction$i9$field24 = 0, $memberFunction$i9$index23 = 0, $upcast$i = 0, $upcast$i23 = 0, $upcast$i32 = 0, $upcast$i41 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 608|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $args$i$i44 = sp + 587|0;
 $7 = sp + 472|0;
 $args$i38 = sp + 590|0;
 $8 = sp + 40|0;
 $args$i$i35 = sp + 591|0;
 $16 = sp + 432|0;
 $args$i29 = sp + 597|0;
 $17 = sp + 32|0;
 $args$i$i26 = sp + 598|0;
 $25 = sp + 536|0;
 $args$i20 = sp + 602|0;
 $26 = sp + 80|0;
 $29 = sp + 552|0;
 $args$i17 = sp + 604|0;
 $30 = sp + 88|0;
 $33 = sp + 240|0;
 $args$i14 = sp + 603|0;
 $34 = sp + 24|0;
 $37 = sp + 184|0;
 $args$i11 = sp + 601|0;
 $38 = sp + 72|0;
 $41 = sp + 112|0;
 $args$i8 = sp + 600|0;
 $42 = sp + 64|0;
 $45 = sp + 152|0;
 $args$i5 = sp + 599|0;
 $46 = sp + 56|0;
 $47 = sp + 48|0;
 $50 = sp + 272|0;
 $args$i2 = sp + 596|0;
 $51 = sp + 96|0;
 $52 = sp + 16|0;
 $55 = sp + 312|0;
 $args$i = sp + 594|0;
 $56 = sp + 8|0;
 $57 = sp;
 $args$i$i = sp + 592|0;
 $64 = sp + 586|0;
 $65 = sp + 584|0;
 $66 = sp + 328|0;
 $67 = sp + 589|0;
 $68 = sp + 296|0;
 $69 = sp + 588|0;
 $70 = sp + 288|0;
 $71 = sp + 264|0;
 $72 = sp + 248|0;
 $73 = sp + 168|0;
 $74 = sp + 136|0;
 $75 = sp + 128|0;
 $76 = sp + 593|0;
 $77 = sp + 192|0;
 $78 = sp + 585|0;
 $79 = sp + 224|0;
 $80 = sp + 595|0;
 $63 = $this;
 $61 = $64;
 $62 = 288;
 __ZN10emscripten8internal11NoBaseClass6verifyI15CredictCardBaseEEvv();
 $_getActualType$i = 51;
 $81 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI15CredictCardBaseEEPFvvEv()|0);
 $upcast$i = $81;
 $82 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI15CredictCardBaseEEPFvvEv()|0);
 $downcast$i = $82;
 $destructor$i = 52;
 $83 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $84 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI15CredictCardBaseEEE3getEv()|0);
 $85 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK15CredictCardBaseEEE3getEv()|0);
 $86 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $87 = $_getActualType$i;
 $88 = (__ZN10emscripten8internal12getSignatureIPKvJP15CredictCardBaseEEEPKcPFT_DpT0_E($87)|0);
 $89 = $_getActualType$i;
 $90 = $upcast$i;
 $91 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($90)|0);
 $92 = $upcast$i;
 $93 = $downcast$i;
 $94 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($93)|0);
 $95 = $downcast$i;
 $96 = $62;
 $97 = $destructor$i;
 $98 = (__ZN10emscripten8internal12getSignatureIvJP15CredictCardBaseEEEPKcPFT_DpT0_E($97)|0);
 $99 = $destructor$i;
 __embind_register_class(($83|0),($84|0),($85|0),($86|0),($88|0),($89|0),($91|0),($92|0),($94|0),($95|0),($96|0),($98|0),($99|0));
 $60 = $64;
 $100 = $60;
 $58 = $100;
 $59 = 53;
 $101 = $58;
 $invoke$i$i = 54;
 $102 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $103 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15CredictCardBaseONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEOiEE8getCountEv($args$i$i)|0);
 $104 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15CredictCardBaseONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEOiEE8getTypesEv($args$i$i)|0);
 $105 = $invoke$i$i;
 $106 = (__ZN10emscripten8internal12getSignatureIP15CredictCardBaseJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEOiEPNS0_11BindingTypeISA_EUt_EiEEEPKcPFT_DpT0_E($105)|0);
 $107 = $invoke$i$i;
 $108 = $59;
 __embind_register_class_constructor(($102|0),($103|0),($104|0),($106|0),($107|0),($108|0));
 HEAP32[$66>>2] = 8;
 $$index1 = ((($66)) + 4|0);
 HEAP32[$$index1>>2] = 1;
 ;HEAP8[$56>>0]=HEAP8[$65>>0]|0;
 ;HEAP8[$57>>0]=HEAP8[$66>>0]|0;HEAP8[$57+1>>0]=HEAP8[$66+1>>0]|0;HEAP8[$57+2>>0]=HEAP8[$66+2>>0]|0;HEAP8[$57+3>>0]=HEAP8[$66+3>>0]|0;HEAP8[$57+4>>0]=HEAP8[$66+4>>0]|0;HEAP8[$57+5>>0]=HEAP8[$66+5>>0]|0;HEAP8[$57+6>>0]=HEAP8[$66+6>>0]|0;HEAP8[$57+7>>0]=HEAP8[$66+7>>0]|0;
 $memberFunction$i$field = HEAP32[$57>>2]|0;
 $memberFunction$i$index2 = ((($57)) + 4|0);
 $memberFunction$i$field3 = HEAP32[$memberFunction$i$index2>>2]|0;
 $53 = $101;
 $54 = 304;
 HEAP32[$55>>2] = $memberFunction$i$field;
 $$index6 = ((($55)) + 4|0);
 HEAP32[$$index6>>2] = $memberFunction$i$field3;
 $109 = $53;
 $invoker$i = 55;
 $110 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $111 = $54;
 $112 = (__ZNK10emscripten8internal12WithPoliciesIJNS_12pure_virtualEEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($args$i)|0);
 $113 = (__ZNK10emscripten8internal12WithPoliciesIJNS_12pure_virtualEEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($args$i)|0);
 $114 = $invoker$i;
 $115 = (__ZN10emscripten8internal12getSignatureIiJRKM15CredictCardBaseFivEPS2_EEEPKcPFT_DpT0_E($114)|0);
 $116 = $invoker$i;
 $117 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFivEEEPT_RKS5_($55)|0);
 __embind_register_class_function(($110|0),($111|0),($112|0),($113|0),($115|0),($116|0),($117|0),1);
 HEAP32[$68>>2] = (56);
 $$index8 = ((($68)) + 4|0);
 HEAP32[$$index8>>2] = 0;
 ;HEAP8[$51>>0]=HEAP8[$67>>0]|0;
 ;HEAP8[$52>>0]=HEAP8[$68>>0]|0;HEAP8[$52+1>>0]=HEAP8[$68+1>>0]|0;HEAP8[$52+2>>0]=HEAP8[$68+2>>0]|0;HEAP8[$52+3>>0]=HEAP8[$68+3>>0]|0;HEAP8[$52+4>>0]=HEAP8[$68+4>>0]|0;HEAP8[$52+5>>0]=HEAP8[$68+5>>0]|0;HEAP8[$52+6>>0]=HEAP8[$68+6>>0]|0;HEAP8[$52+7>>0]=HEAP8[$68+7>>0]|0;
 $memberFunction$i3$field = HEAP32[$52>>2]|0;
 $memberFunction$i3$index9 = ((($52)) + 4|0);
 $memberFunction$i3$field10 = HEAP32[$memberFunction$i3$index9>>2]|0;
 $48 = $109;
 $49 = 320;
 HEAP32[$50>>2] = $memberFunction$i3$field;
 $$index13 = ((($50)) + 4|0);
 HEAP32[$$index13>>2] = $memberFunction$i3$field10;
 $118 = $48;
 $invoker$i1 = 57;
 $119 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $120 = $49;
 $121 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getCountEv($args$i2)|0);
 $122 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getTypesEv($args$i2)|0);
 $123 = $invoker$i1;
 $124 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvP4BillEPS2_S4_EEEPKcPFT_DpT0_E($123)|0);
 $125 = $invoker$i1;
 $126 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvP4BillEEEPT_RKS7_($50)|0);
 __embind_register_class_function(($119|0),($120|0),($121|0),($122|0),($124|0),($125|0),($126|0),0);
 HEAP32[$70>>2] = (58);
 $$index15 = ((($70)) + 4|0);
 HEAP32[$$index15>>2] = 0;
 ;HEAP8[$46>>0]=HEAP8[$69>>0]|0;
 ;HEAP8[$47>>0]=HEAP8[$70>>0]|0;HEAP8[$47+1>>0]=HEAP8[$70+1>>0]|0;HEAP8[$47+2>>0]=HEAP8[$70+2>>0]|0;HEAP8[$47+3>>0]=HEAP8[$70+3>>0]|0;HEAP8[$47+4>>0]=HEAP8[$70+4>>0]|0;HEAP8[$47+5>>0]=HEAP8[$70+5>>0]|0;HEAP8[$47+6>>0]=HEAP8[$70+6>>0]|0;HEAP8[$47+7>>0]=HEAP8[$70+7>>0]|0;
 $memberFunction$i6$field = HEAP32[$47>>2]|0;
 $memberFunction$i6$index16 = ((($47)) + 4|0);
 $memberFunction$i6$field17 = HEAP32[$memberFunction$i6$index16>>2]|0;
 $43 = $118;
 $44 = 344;
 HEAP32[$45>>2] = $memberFunction$i6$field;
 $$index20 = ((($45)) + 4|0);
 HEAP32[$$index20>>2] = $memberFunction$i6$field17;
 $127 = $43;
 $invoker$i4 = 57;
 $128 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $129 = $44;
 $130 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getCountEv($args$i5)|0);
 $131 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getTypesEv($args$i5)|0);
 $132 = $invoker$i4;
 $133 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvP4BillEPS2_S4_EEEPKcPFT_DpT0_E($132)|0);
 $134 = $invoker$i4;
 $135 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvP4BillEEEPT_RKS7_($45)|0);
 __embind_register_class_function(($128|0),($129|0),($130|0),($131|0),($133|0),($134|0),($135|0),0);
 HEAP32[$71>>2] = (59);
 $$index22 = ((($71)) + 4|0);
 HEAP32[$$index22>>2] = 0;
 ;HEAP8[$42>>0]=HEAP8[$71>>0]|0;HEAP8[$42+1>>0]=HEAP8[$71+1>>0]|0;HEAP8[$42+2>>0]=HEAP8[$71+2>>0]|0;HEAP8[$42+3>>0]=HEAP8[$71+3>>0]|0;HEAP8[$42+4>>0]=HEAP8[$71+4>>0]|0;HEAP8[$42+5>>0]=HEAP8[$71+5>>0]|0;HEAP8[$42+6>>0]=HEAP8[$71+6>>0]|0;HEAP8[$42+7>>0]=HEAP8[$71+7>>0]|0;
 $memberFunction$i9$field = HEAP32[$42>>2]|0;
 $memberFunction$i9$index23 = ((($42)) + 4|0);
 $memberFunction$i9$field24 = HEAP32[$memberFunction$i9$index23>>2]|0;
 $39 = $127;
 $40 = 360;
 HEAP32[$41>>2] = $memberFunction$i9$field;
 $$index27 = ((($41)) + 4|0);
 HEAP32[$$index27>>2] = $memberFunction$i9$field24;
 $136 = $39;
 $invoker$i7 = 60;
 $137 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $138 = $40;
 $139 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($args$i8)|0);
 $140 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($args$i8)|0);
 $141 = $invoker$i7;
 $142 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvvEPS2_EEEPKcPFT_DpT0_E($141)|0);
 $143 = $invoker$i7;
 $144 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvvEEEPT_RKS5_($41)|0);
 __embind_register_class_function(($137|0),($138|0),($139|0),($140|0),($142|0),($143|0),($144|0),0);
 HEAP32[$72>>2] = (61);
 $$index29 = ((($72)) + 4|0);
 HEAP32[$$index29>>2] = 0;
 ;HEAP8[$38>>0]=HEAP8[$72>>0]|0;HEAP8[$38+1>>0]=HEAP8[$72+1>>0]|0;HEAP8[$38+2>>0]=HEAP8[$72+2>>0]|0;HEAP8[$38+3>>0]=HEAP8[$72+3>>0]|0;HEAP8[$38+4>>0]=HEAP8[$72+4>>0]|0;HEAP8[$38+5>>0]=HEAP8[$72+5>>0]|0;HEAP8[$38+6>>0]=HEAP8[$72+6>>0]|0;HEAP8[$38+7>>0]=HEAP8[$72+7>>0]|0;
 $memberFunction$i12$field = HEAP32[$38>>2]|0;
 $memberFunction$i12$index30 = ((($38)) + 4|0);
 $memberFunction$i12$field31 = HEAP32[$memberFunction$i12$index30>>2]|0;
 $35 = $136;
 $36 = 376;
 HEAP32[$37>>2] = $memberFunction$i12$field;
 $$index34 = ((($37)) + 4|0);
 HEAP32[$$index34>>2] = $memberFunction$i12$field31;
 $145 = $35;
 $invoker$i10 = 55;
 $146 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $147 = $36;
 $148 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($args$i11)|0);
 $149 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($args$i11)|0);
 $150 = $invoker$i10;
 $151 = (__ZN10emscripten8internal12getSignatureIiJRKM15CredictCardBaseFivEPS2_EEEPKcPFT_DpT0_E($150)|0);
 $152 = $invoker$i10;
 $153 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFivEEEPT_RKS5_($37)|0);
 __embind_register_class_function(($146|0),($147|0),($148|0),($149|0),($151|0),($152|0),($153|0),0);
 HEAP32[$73>>2] = (62);
 $$index36 = ((($73)) + 4|0);
 HEAP32[$$index36>>2] = 0;
 ;HEAP8[$34>>0]=HEAP8[$73>>0]|0;HEAP8[$34+1>>0]=HEAP8[$73+1>>0]|0;HEAP8[$34+2>>0]=HEAP8[$73+2>>0]|0;HEAP8[$34+3>>0]=HEAP8[$73+3>>0]|0;HEAP8[$34+4>>0]=HEAP8[$73+4>>0]|0;HEAP8[$34+5>>0]=HEAP8[$73+5>>0]|0;HEAP8[$34+6>>0]=HEAP8[$73+6>>0]|0;HEAP8[$34+7>>0]=HEAP8[$73+7>>0]|0;
 $memberFunction$i15$field = HEAP32[$34>>2]|0;
 $memberFunction$i15$index37 = ((($34)) + 4|0);
 $memberFunction$i15$field38 = HEAP32[$memberFunction$i15$index37>>2]|0;
 $31 = $145;
 $32 = 400;
 HEAP32[$33>>2] = $memberFunction$i15$field;
 $$index41 = ((($33)) + 4|0);
 HEAP32[$$index41>>2] = $memberFunction$i15$field38;
 $154 = $31;
 $invoker$i13 = 60;
 $155 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $156 = $32;
 $157 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($args$i14)|0);
 $158 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($args$i14)|0);
 $159 = $invoker$i13;
 $160 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvvEPS2_EEEPKcPFT_DpT0_E($159)|0);
 $161 = $invoker$i13;
 $162 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvvEEEPT_RKS5_($33)|0);
 __embind_register_class_function(($155|0),($156|0),($157|0),($158|0),($160|0),($161|0),($162|0),0);
 HEAP32[$74>>2] = (63);
 $$index43 = ((($74)) + 4|0);
 HEAP32[$$index43>>2] = 0;
 ;HEAP8[$30>>0]=HEAP8[$74>>0]|0;HEAP8[$30+1>>0]=HEAP8[$74+1>>0]|0;HEAP8[$30+2>>0]=HEAP8[$74+2>>0]|0;HEAP8[$30+3>>0]=HEAP8[$74+3>>0]|0;HEAP8[$30+4>>0]=HEAP8[$74+4>>0]|0;HEAP8[$30+5>>0]=HEAP8[$74+5>>0]|0;HEAP8[$30+6>>0]=HEAP8[$74+6>>0]|0;HEAP8[$30+7>>0]=HEAP8[$74+7>>0]|0;
 $memberFunction$i18$field = HEAP32[$30>>2]|0;
 $memberFunction$i18$index44 = ((($30)) + 4|0);
 $memberFunction$i18$field45 = HEAP32[$memberFunction$i18$index44>>2]|0;
 $27 = $154;
 $28 = 424;
 HEAP32[$29>>2] = $memberFunction$i18$field;
 $$index48 = ((($29)) + 4|0);
 HEAP32[$$index48>>2] = $memberFunction$i18$field45;
 $163 = $27;
 $invoker$i16 = 60;
 $164 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $165 = $28;
 $166 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($args$i17)|0);
 $167 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($args$i17)|0);
 $168 = $invoker$i16;
 $169 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvvEPS2_EEEPKcPFT_DpT0_E($168)|0);
 $170 = $invoker$i16;
 $171 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvvEEEPT_RKS5_($29)|0);
 __embind_register_class_function(($164|0),($165|0),($166|0),($167|0),($169|0),($170|0),($171|0),0);
 HEAP32[$75>>2] = (64);
 $$index50 = ((($75)) + 4|0);
 HEAP32[$$index50>>2] = 0;
 ;HEAP8[$26>>0]=HEAP8[$75>>0]|0;HEAP8[$26+1>>0]=HEAP8[$75+1>>0]|0;HEAP8[$26+2>>0]=HEAP8[$75+2>>0]|0;HEAP8[$26+3>>0]=HEAP8[$75+3>>0]|0;HEAP8[$26+4>>0]=HEAP8[$75+4>>0]|0;HEAP8[$26+5>>0]=HEAP8[$75+5>>0]|0;HEAP8[$26+6>>0]=HEAP8[$75+6>>0]|0;HEAP8[$26+7>>0]=HEAP8[$75+7>>0]|0;
 $memberFunction$i21$field = HEAP32[$26>>2]|0;
 $memberFunction$i21$index51 = ((($26)) + 4|0);
 $memberFunction$i21$field52 = HEAP32[$memberFunction$i21$index51>>2]|0;
 $23 = $163;
 $24 = 440;
 HEAP32[$25>>2] = $memberFunction$i21$field;
 $$index55 = ((($25)) + 4|0);
 HEAP32[$$index55>>2] = $memberFunction$i21$field52;
 $invoker$i19 = 65;
 $172 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 $173 = $24;
 $174 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS7_9allocatorISA_EEEEEE8getCountEv($args$i20)|0);
 $175 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS7_9allocatorISA_EEEEEE8getTypesEv($args$i20)|0);
 $176 = $invoker$i19;
 $177 = (__ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEPS2_PS9_EEEPKcPFT_DpT0_E($176)|0);
 $178 = $invoker$i19;
 $179 = (__ZN10emscripten8internal10getContextIM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEEPT_RKSD_($25)|0);
 __embind_register_class_function(($172|0),($173|0),($174|0),($175|0),($177|0),($178|0),($179|0),0);
 $21 = $76;
 $22 = 464;
 __ZN10emscripten4baseI15CredictCardBaseE6verifyI13CredictCardHNEEvv();
 $_getActualType$i22 = 66;
 $180 = (__ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI13CredictCardHNEEPFPS1_PT_Ev()|0);
 $upcast$i23 = $180;
 $181 = (__ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI13CredictCardHNEEPFPT_PS1_Ev()|0);
 $downcast$i24 = $181;
 $destructor$i25 = 67;
 $182 = (__ZN10emscripten8internal6TypeIDI13CredictCardHNE3getEv()|0);
 $183 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13CredictCardHNEEE3getEv()|0);
 $184 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13CredictCardHNEEE3getEv()|0);
 $185 = (__ZN10emscripten4baseI15CredictCardBaseE3getEv()|0);
 $186 = $_getActualType$i22;
 $187 = (__ZN10emscripten8internal12getSignatureIPKvJP13CredictCardHNEEEPKcPFT_DpT0_E($186)|0);
 $188 = $_getActualType$i22;
 $189 = $upcast$i23;
 $190 = (__ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP13CredictCardHNEEEPKcPFT_DpT0_E($189)|0);
 $191 = $upcast$i23;
 $192 = $downcast$i24;
 $193 = (__ZN10emscripten8internal12getSignatureIP13CredictCardHNJP15CredictCardBaseEEEPKcPFT_DpT0_E($192)|0);
 $194 = $downcast$i24;
 $195 = $22;
 $196 = $destructor$i25;
 $197 = (__ZN10emscripten8internal12getSignatureIvJP13CredictCardHNEEEPKcPFT_DpT0_E($196)|0);
 $198 = $destructor$i25;
 __embind_register_class(($182|0),($183|0),($184|0),($185|0),($187|0),($188|0),($190|0),($191|0),($193|0),($194|0),($195|0),($197|0),($198|0));
 $20 = $76;
 $199 = $20;
 $18 = $199;
 $19 = 68;
 $200 = $18;
 $invoke$i$i27 = 69;
 $201 = (__ZN10emscripten8internal6TypeIDI13CredictCardHNE3getEv()|0);
 $202 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardHNONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($args$i$i26)|0);
 $203 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardHNONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($args$i$i26)|0);
 $204 = $invoke$i$i27;
 $205 = (__ZN10emscripten8internal12getSignatureIP13CredictCardHNJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($204)|0);
 $206 = $invoke$i$i27;
 $207 = $19;
 __embind_register_class_constructor(($201|0),($202|0),($203|0),($205|0),($206|0),($207|0));
 HEAP32[$77>>2] = 8;
 $$index57 = ((($77)) + 4|0);
 HEAP32[$$index57>>2] = 1;
 ;HEAP8[$17>>0]=HEAP8[$77>>0]|0;HEAP8[$17+1>>0]=HEAP8[$77+1>>0]|0;HEAP8[$17+2>>0]=HEAP8[$77+2>>0]|0;HEAP8[$17+3>>0]=HEAP8[$77+3>>0]|0;HEAP8[$17+4>>0]=HEAP8[$77+4>>0]|0;HEAP8[$17+5>>0]=HEAP8[$77+5>>0]|0;HEAP8[$17+6>>0]=HEAP8[$77+6>>0]|0;HEAP8[$17+7>>0]=HEAP8[$77+7>>0]|0;
 $memberFunction$i30$field = HEAP32[$17>>2]|0;
 $memberFunction$i30$index58 = ((($17)) + 4|0);
 $memberFunction$i30$field59 = HEAP32[$memberFunction$i30$index58>>2]|0;
 $14 = $200;
 $15 = 480;
 HEAP32[$16>>2] = $memberFunction$i30$field;
 $$index62 = ((($16)) + 4|0);
 HEAP32[$$index62>>2] = $memberFunction$i30$field59;
 $invoker$i28 = 70;
 $208 = (__ZN10emscripten8internal6TypeIDI13CredictCardHNE3getEv()|0);
 $209 = $15;
 $210 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEE8getCountEv($args$i29)|0);
 $211 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEE8getTypesEv($args$i29)|0);
 $212 = $invoker$i28;
 $213 = (__ZN10emscripten8internal12getSignatureIiJRKM13CredictCardHNFivEPS2_EEEPKcPFT_DpT0_E($212)|0);
 $214 = $invoker$i28;
 $215 = (__ZN10emscripten8internal10getContextIM13CredictCardHNFivEEEPT_RKS5_($16)|0);
 __embind_register_class_function(($208|0),($209|0),($210|0),($211|0),($213|0),($214|0),($215|0),0);
 $12 = $78;
 $13 = 496;
 __ZN10emscripten4baseI15CredictCardBaseE6verifyI13CredictCardYSEEvv();
 $_getActualType$i31 = 71;
 $216 = (__ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI13CredictCardYSEEPFPS1_PT_Ev()|0);
 $upcast$i32 = $216;
 $217 = (__ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI13CredictCardYSEEPFPT_PS1_Ev()|0);
 $downcast$i33 = $217;
 $destructor$i34 = 72;
 $218 = (__ZN10emscripten8internal6TypeIDI13CredictCardYSE3getEv()|0);
 $219 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13CredictCardYSEEE3getEv()|0);
 $220 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13CredictCardYSEEE3getEv()|0);
 $221 = (__ZN10emscripten4baseI15CredictCardBaseE3getEv()|0);
 $222 = $_getActualType$i31;
 $223 = (__ZN10emscripten8internal12getSignatureIPKvJP13CredictCardYSEEEPKcPFT_DpT0_E($222)|0);
 $224 = $_getActualType$i31;
 $225 = $upcast$i32;
 $226 = (__ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP13CredictCardYSEEEPKcPFT_DpT0_E($225)|0);
 $227 = $upcast$i32;
 $228 = $downcast$i33;
 $229 = (__ZN10emscripten8internal12getSignatureIP13CredictCardYSJP15CredictCardBaseEEEPKcPFT_DpT0_E($228)|0);
 $230 = $downcast$i33;
 $231 = $13;
 $232 = $destructor$i34;
 $233 = (__ZN10emscripten8internal12getSignatureIvJP13CredictCardYSEEEPKcPFT_DpT0_E($232)|0);
 $234 = $destructor$i34;
 __embind_register_class(($218|0),($219|0),($220|0),($221|0),($223|0),($224|0),($226|0),($227|0),($229|0),($230|0),($231|0),($233|0),($234|0));
 $11 = $78;
 $235 = $11;
 $9 = $235;
 $10 = 73;
 $236 = $9;
 $invoke$i$i36 = 74;
 $237 = (__ZN10emscripten8internal6TypeIDI13CredictCardYSE3getEv()|0);
 $238 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardYSONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($args$i$i35)|0);
 $239 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardYSONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($args$i$i35)|0);
 $240 = $invoke$i$i36;
 $241 = (__ZN10emscripten8internal12getSignatureIP13CredictCardYSJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($240)|0);
 $242 = $invoke$i$i36;
 $243 = $10;
 __embind_register_class_constructor(($237|0),($238|0),($239|0),($241|0),($242|0),($243|0));
 HEAP32[$79>>2] = 8;
 $$index64 = ((($79)) + 4|0);
 HEAP32[$$index64>>2] = 1;
 ;HEAP8[$8>>0]=HEAP8[$79>>0]|0;HEAP8[$8+1>>0]=HEAP8[$79+1>>0]|0;HEAP8[$8+2>>0]=HEAP8[$79+2>>0]|0;HEAP8[$8+3>>0]=HEAP8[$79+3>>0]|0;HEAP8[$8+4>>0]=HEAP8[$79+4>>0]|0;HEAP8[$8+5>>0]=HEAP8[$79+5>>0]|0;HEAP8[$8+6>>0]=HEAP8[$79+6>>0]|0;HEAP8[$8+7>>0]=HEAP8[$79+7>>0]|0;
 $memberFunction$i39$field = HEAP32[$8>>2]|0;
 $memberFunction$i39$index65 = ((($8)) + 4|0);
 $memberFunction$i39$field66 = HEAP32[$memberFunction$i39$index65>>2]|0;
 $5 = $236;
 $6 = 480;
 HEAP32[$7>>2] = $memberFunction$i39$field;
 $$index69 = ((($7)) + 4|0);
 HEAP32[$$index69>>2] = $memberFunction$i39$field66;
 $invoker$i37 = 75;
 $244 = (__ZN10emscripten8internal6TypeIDI13CredictCardYSE3getEv()|0);
 $245 = $6;
 $246 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEE8getCountEv($args$i38)|0);
 $247 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEE8getTypesEv($args$i38)|0);
 $248 = $invoker$i37;
 $249 = (__ZN10emscripten8internal12getSignatureIiJRKM13CredictCardYSFivEPS2_EEEPKcPFT_DpT0_E($248)|0);
 $250 = $invoker$i37;
 $251 = (__ZN10emscripten8internal10getContextIM13CredictCardYSFivEEEPT_RKS5_($7)|0);
 __embind_register_class_function(($244|0),($245|0),($246|0),($247|0),($249|0),($250|0),($251|0),0);
 $3 = $80;
 $4 = 512;
 __ZN10emscripten4baseI15CredictCardBaseE6verifyI18CredictCardHNICashEEvv();
 $_getActualType$i40 = 76;
 $252 = (__ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI18CredictCardHNICashEEPFPS1_PT_Ev()|0);
 $upcast$i41 = $252;
 $253 = (__ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI18CredictCardHNICashEEPFPT_PS1_Ev()|0);
 $downcast$i42 = $253;
 $destructor$i43 = 77;
 $254 = (__ZN10emscripten8internal6TypeIDI18CredictCardHNICashE3getEv()|0);
 $255 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI18CredictCardHNICashEEE3getEv()|0);
 $256 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK18CredictCardHNICashEEE3getEv()|0);
 $257 = (__ZN10emscripten4baseI15CredictCardBaseE3getEv()|0);
 $258 = $_getActualType$i40;
 $259 = (__ZN10emscripten8internal12getSignatureIPKvJP18CredictCardHNICashEEEPKcPFT_DpT0_E($258)|0);
 $260 = $_getActualType$i40;
 $261 = $upcast$i41;
 $262 = (__ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP18CredictCardHNICashEEEPKcPFT_DpT0_E($261)|0);
 $263 = $upcast$i41;
 $264 = $downcast$i42;
 $265 = (__ZN10emscripten8internal12getSignatureIP18CredictCardHNICashJP15CredictCardBaseEEEPKcPFT_DpT0_E($264)|0);
 $266 = $downcast$i42;
 $267 = $4;
 $268 = $destructor$i43;
 $269 = (__ZN10emscripten8internal12getSignatureIvJP18CredictCardHNICashEEEPKcPFT_DpT0_E($268)|0);
 $270 = $destructor$i43;
 __embind_register_class(($254|0),($255|0),($256|0),($257|0),($259|0),($260|0),($262|0),($263|0),($265|0),($266|0),($267|0),($269|0),($270|0));
 $2 = $80;
 $271 = $2;
 $0 = $271;
 $1 = 78;
 $invoke$i$i45 = 79;
 $272 = (__ZN10emscripten8internal6TypeIDI18CredictCardHNICashE3getEv()|0);
 $273 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP18CredictCardHNICashONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($args$i$i44)|0);
 $274 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP18CredictCardHNICashONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($args$i$i44)|0);
 $275 = $invoke$i$i45;
 $276 = (__ZN10emscripten8internal12getSignatureIP18CredictCardHNICashJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($275)|0);
 $277 = $invoke$i$i45;
 $278 = $1;
 __embind_register_class_constructor(($272|0),($273|0),($274|0),($276|0),($277|0),($278|0));
 STACKTOP = sp;return;
}
function __ZN43EmscriptenBindingInitializer_CredictCardMgrC2Ev($this) {
 $this = $this|0;
 var $$index1 = 0, $$index13 = 0, $$index15 = 0, $$index20 = 0, $$index22 = 0, $$index27 = 0, $$index6 = 0, $$index8 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
 var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
 var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
 var $92 = 0, $93 = 0, $_getActualType$i = 0, $args$i = 0, $args$i$i = 0, $args$i2 = 0, $args$i5 = 0, $args$i8 = 0, $destructor$i = 0, $downcast$i = 0, $invoke$i$i = 0, $invoker$i = 0, $invoker$i1 = 0, $invoker$i4 = 0, $invoker$i7 = 0, $memberFunction$i$field = 0, $memberFunction$i$field3 = 0, $memberFunction$i$index2 = 0, $memberFunction$i3$field = 0, $memberFunction$i3$field10 = 0;
 var $memberFunction$i3$index9 = 0, $memberFunction$i6$field = 0, $memberFunction$i6$field17 = 0, $memberFunction$i6$index16 = 0, $memberFunction$i9$field = 0, $memberFunction$i9$field24 = 0, $memberFunction$i9$index23 = 0, $upcast$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 176|0;
 $args$i8 = sp + 217|0;
 $3 = sp + 24|0;
 $6 = sp + 152|0;
 $args$i5 = sp + 219|0;
 $7 = sp + 32|0;
 $10 = sp + 192|0;
 $args$i2 = sp + 214|0;
 $11 = sp + 16|0;
 $12 = sp + 8|0;
 $15 = sp + 136|0;
 $args$i = sp + 215|0;
 $16 = sp;
 $17 = sp + 40|0;
 $args$i$i = sp + 218|0;
 $24 = sp + 216|0;
 $25 = sp + 213|0;
 $26 = sp + 96|0;
 $27 = sp + 212|0;
 $28 = sp + 104|0;
 $29 = sp + 112|0;
 $30 = sp + 120|0;
 $23 = $this;
 $21 = $24;
 $22 = 536;
 __ZN10emscripten8internal11NoBaseClass6verifyI14CredictCardMgrEEvv();
 $_getActualType$i = 80;
 $31 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI14CredictCardMgrEEPFvvEv()|0);
 $upcast$i = $31;
 $32 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI14CredictCardMgrEEPFvvEv()|0);
 $downcast$i = $32;
 $destructor$i = 81;
 $33 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $34 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI14CredictCardMgrEEE3getEv()|0);
 $35 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK14CredictCardMgrEEE3getEv()|0);
 $36 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $37 = $_getActualType$i;
 $38 = (__ZN10emscripten8internal12getSignatureIPKvJP14CredictCardMgrEEEPKcPFT_DpT0_E($37)|0);
 $39 = $_getActualType$i;
 $40 = $upcast$i;
 $41 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($40)|0);
 $42 = $upcast$i;
 $43 = $downcast$i;
 $44 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($43)|0);
 $45 = $downcast$i;
 $46 = $22;
 $47 = $destructor$i;
 $48 = (__ZN10emscripten8internal12getSignatureIvJP14CredictCardMgrEEEPKcPFT_DpT0_E($47)|0);
 $49 = $destructor$i;
 __embind_register_class(($33|0),($34|0),($35|0),($36|0),($38|0),($39|0),($41|0),($42|0),($44|0),($45|0),($46|0),($48|0),($49|0));
 $20 = $24;
 $50 = $20;
 $18 = $50;
 $19 = 82;
 $51 = $18;
 $invoke$i$i = 83;
 $52 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $53 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP14CredictCardMgrEE8getCountEv($args$i$i)|0);
 $54 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP14CredictCardMgrEE8getTypesEv($args$i$i)|0);
 $55 = $invoke$i$i;
 $56 = (__ZN10emscripten8internal12getSignatureIP14CredictCardMgrJPFS3_vEEEEPKcPFT_DpT0_E($55)|0);
 $57 = $invoke$i$i;
 $58 = $19;
 __embind_register_class_constructor(($52|0),($53|0),($54|0),($56|0),($57|0),($58|0));
 HEAP32[$26>>2] = (84);
 $$index1 = ((($26)) + 4|0);
 HEAP32[$$index1>>2] = 0;
 ;HEAP8[$16>>0]=HEAP8[$25>>0]|0;
 ;HEAP8[$17>>0]=HEAP8[$26>>0]|0;HEAP8[$17+1>>0]=HEAP8[$26+1>>0]|0;HEAP8[$17+2>>0]=HEAP8[$26+2>>0]|0;HEAP8[$17+3>>0]=HEAP8[$26+3>>0]|0;HEAP8[$17+4>>0]=HEAP8[$26+4>>0]|0;HEAP8[$17+5>>0]=HEAP8[$26+5>>0]|0;HEAP8[$17+6>>0]=HEAP8[$26+6>>0]|0;HEAP8[$17+7>>0]=HEAP8[$26+7>>0]|0;
 $memberFunction$i$field = HEAP32[$17>>2]|0;
 $memberFunction$i$index2 = ((($17)) + 4|0);
 $memberFunction$i$field3 = HEAP32[$memberFunction$i$index2>>2]|0;
 $13 = $51;
 $14 = 552;
 HEAP32[$15>>2] = $memberFunction$i$field;
 $$index6 = ((($15)) + 4|0);
 HEAP32[$$index6>>2] = $memberFunction$i$field3;
 $59 = $13;
 $invoker$i = 85;
 $60 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $61 = $14;
 $62 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP4BillP15CredictCardBaseEE8getCountEv($args$i)|0);
 $63 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP4BillP15CredictCardBaseEE8getTypesEv($args$i)|0);
 $64 = $invoker$i;
 $65 = (__ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvP4BillP15CredictCardBaseEPS2_S4_S6_EEEPKcPFT_DpT0_E($64)|0);
 $66 = $invoker$i;
 $67 = (__ZN10emscripten8internal10getContextIM14CredictCardMgrFvP4BillP15CredictCardBaseEEEPT_RKS9_($15)|0);
 __embind_register_class_function(($60|0),($61|0),($62|0),($63|0),($65|0),($66|0),($67|0),0);
 HEAP32[$28>>2] = (86);
 $$index8 = ((($28)) + 4|0);
 HEAP32[$$index8>>2] = 0;
 ;HEAP8[$11>>0]=HEAP8[$27>>0]|0;
 ;HEAP8[$12>>0]=HEAP8[$28>>0]|0;HEAP8[$12+1>>0]=HEAP8[$28+1>>0]|0;HEAP8[$12+2>>0]=HEAP8[$28+2>>0]|0;HEAP8[$12+3>>0]=HEAP8[$28+3>>0]|0;HEAP8[$12+4>>0]=HEAP8[$28+4>>0]|0;HEAP8[$12+5>>0]=HEAP8[$28+5>>0]|0;HEAP8[$12+6>>0]=HEAP8[$28+6>>0]|0;HEAP8[$12+7>>0]=HEAP8[$28+7>>0]|0;
 $memberFunction$i3$field = HEAP32[$12>>2]|0;
 $memberFunction$i3$index9 = ((($12)) + 4|0);
 $memberFunction$i3$field10 = HEAP32[$memberFunction$i3$index9>>2]|0;
 $8 = $59;
 $9 = 560;
 HEAP32[$10>>2] = $memberFunction$i3$field;
 $$index13 = ((($10)) + 4|0);
 HEAP32[$$index13>>2] = $memberFunction$i3$field10;
 $68 = $8;
 $invoker$i1 = 87;
 $69 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $70 = $9;
 $71 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP15CredictCardBaseEE8getCountEv($args$i2)|0);
 $72 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP15CredictCardBaseEE8getTypesEv($args$i2)|0);
 $73 = $invoker$i1;
 $74 = (__ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvP15CredictCardBaseEPS2_S4_EEEPKcPFT_DpT0_E($73)|0);
 $75 = $invoker$i1;
 $76 = (__ZN10emscripten8internal10getContextIM14CredictCardMgrFvP15CredictCardBaseEEEPT_RKS7_($10)|0);
 __embind_register_class_function(($69|0),($70|0),($71|0),($72|0),($74|0),($75|0),($76|0),0);
 HEAP32[$29>>2] = (88);
 $$index15 = ((($29)) + 4|0);
 HEAP32[$$index15>>2] = 0;
 ;HEAP8[$7>>0]=HEAP8[$29>>0]|0;HEAP8[$7+1>>0]=HEAP8[$29+1>>0]|0;HEAP8[$7+2>>0]=HEAP8[$29+2>>0]|0;HEAP8[$7+3>>0]=HEAP8[$29+3>>0]|0;HEAP8[$7+4>>0]=HEAP8[$29+4>>0]|0;HEAP8[$7+5>>0]=HEAP8[$29+5>>0]|0;HEAP8[$7+6>>0]=HEAP8[$29+6>>0]|0;HEAP8[$7+7>>0]=HEAP8[$29+7>>0]|0;
 $memberFunction$i6$field = HEAP32[$7>>2]|0;
 $memberFunction$i6$index16 = ((($7)) + 4|0);
 $memberFunction$i6$field17 = HEAP32[$memberFunction$i6$index16>>2]|0;
 $4 = $68;
 $5 = 568;
 HEAP32[$6>>2] = $memberFunction$i6$field;
 $$index20 = ((($6)) + 4|0);
 HEAP32[$$index20>>2] = $memberFunction$i6$field17;
 $77 = $4;
 $invoker$i4 = 89;
 $78 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $79 = $5;
 $80 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getCountEv($args$i5)|0);
 $81 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getTypesEv($args$i5)|0);
 $82 = $invoker$i4;
 $83 = (__ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvvEPS2_EEEPKcPFT_DpT0_E($82)|0);
 $84 = $invoker$i4;
 $85 = (__ZN10emscripten8internal10getContextIM14CredictCardMgrFvvEEEPT_RKS5_($6)|0);
 __embind_register_class_function(($78|0),($79|0),($80|0),($81|0),($83|0),($84|0),($85|0),0);
 HEAP32[$30>>2] = (90);
 $$index22 = ((($30)) + 4|0);
 HEAP32[$$index22>>2] = 0;
 ;HEAP8[$3>>0]=HEAP8[$30>>0]|0;HEAP8[$3+1>>0]=HEAP8[$30+1>>0]|0;HEAP8[$3+2>>0]=HEAP8[$30+2>>0]|0;HEAP8[$3+3>>0]=HEAP8[$30+3>>0]|0;HEAP8[$3+4>>0]=HEAP8[$30+4>>0]|0;HEAP8[$3+5>>0]=HEAP8[$30+5>>0]|0;HEAP8[$3+6>>0]=HEAP8[$30+6>>0]|0;HEAP8[$3+7>>0]=HEAP8[$30+7>>0]|0;
 $memberFunction$i9$field = HEAP32[$3>>2]|0;
 $memberFunction$i9$index23 = ((($3)) + 4|0);
 $memberFunction$i9$field24 = HEAP32[$memberFunction$i9$index23>>2]|0;
 $0 = $77;
 $1 = 584;
 HEAP32[$2>>2] = $memberFunction$i9$field;
 $$index27 = ((($2)) + 4|0);
 HEAP32[$$index27>>2] = $memberFunction$i9$field24;
 $invoker$i7 = 91;
 $86 = (__ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv()|0);
 $87 = $1;
 $88 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getCountEv($args$i8)|0);
 $89 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getTypesEv($args$i8)|0);
 $90 = $invoker$i7;
 $91 = (__ZN10emscripten8internal12getSignatureIiJRKM14CredictCardMgrFivEPS2_EEEPKcPFT_DpT0_E($90)|0);
 $92 = $invoker$i7;
 $93 = (__ZN10emscripten8internal10getContextIM14CredictCardMgrFivEEEPT_RKS5_($2)|0);
 __embind_register_class_function(($86|0),($87|0),($88|0),($89|0),($91|0),($92|0),($93|0),0);
 STACKTOP = sp;return;
}
function __ZN14CredictCardMgr7addBillEP4BillP15CredictCardBase($this,$b,$card) {
 $this = $this|0;
 $b = $b|0;
 $card = $card|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $__annotator$i = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $13 = sp;
 $18 = sp + 124|0;
 $__annotator$i = sp + 125|0;
 $29 = sp + 48|0;
 $28 = $this;
 HEAP32[$29>>2] = $b;
 $30 = $card;
 $31 = $28;
 $32 = $30;
 $33 = ($32|0)==(0|0);
 if ($33) {
  $34 = ((($31)) + 12|0);
  $26 = $34;
  $27 = $29;
  $35 = $26;
  $36 = ((($35)) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $25 = $35;
  $38 = $25;
  $39 = ((($38)) + 8|0);
  $24 = $39;
  $40 = $24;
  $23 = $40;
  $41 = $23;
  $42 = HEAP32[$41>>2]|0;
  $43 = ($37|0)!=($42|0);
  if ($43) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$35,1);
   $22 = $35;
   $44 = $22;
   $45 = ((($44)) + 8|0);
   $21 = $45;
   $46 = $21;
   $20 = $46;
   $47 = $20;
   $48 = ((($35)) + 4|0);
   $49 = HEAP32[$48>>2]|0;
   $19 = $49;
   $50 = $19;
   $51 = $27;
   $15 = $47;
   $16 = $50;
   $17 = $51;
   $52 = $15;
   $53 = $16;
   $54 = $17;
   $14 = $54;
   $55 = $14;
   ;HEAP8[$13>>0]=HEAP8[$18>>0]|0;
   $10 = $52;
   $11 = $53;
   $12 = $55;
   $56 = $10;
   $57 = $11;
   $58 = $12;
   $9 = $58;
   $59 = $9;
   $6 = $56;
   $7 = $57;
   $8 = $59;
   $60 = $7;
   $61 = $8;
   $5 = $61;
   $62 = $5;
   $63 = HEAP32[$62>>2]|0;
   HEAP32[$60>>2] = $63;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
   $64 = ((($35)) + 4|0);
   $65 = HEAP32[$64>>2]|0;
   $66 = ((($65)) + 4|0);
   HEAP32[$64>>2] = $66;
   STACKTOP = sp;return;
  } else {
   $67 = $27;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($35,$67);
   STACKTOP = sp;return;
  }
 }
 $i = 0;
 while(1) {
  $68 = $i;
  $4 = $31;
  $69 = $4;
  $70 = ((($69)) + 4|0);
  $71 = HEAP32[$70>>2]|0;
  $72 = HEAP32[$69>>2]|0;
  $73 = $71;
  $74 = $72;
  $75 = (($73) - ($74))|0;
  $76 = (($75|0) / 4)&-1;
  $77 = ($68>>>0)<($76>>>0);
  if (!($77)) {
   label = 10;
   break;
  }
  $78 = $i;
  $2 = $31;
  $3 = $78;
  $79 = $2;
  $80 = $3;
  $81 = HEAP32[$79>>2]|0;
  $82 = (($81) + ($80<<2)|0);
  $83 = HEAP32[$82>>2]|0;
  $84 = $30;
  $85 = ($83|0)==($84|0);
  if ($85) {
   break;
  }
  $93 = $i;
  $94 = (($93) + 1)|0;
  $i = $94;
 }
 if ((label|0) == 10) {
  ___assert_fail((600|0),(608|0),379,(552|0));
  // unreachable;
 }
 $86 = $i;
 $0 = $31;
 $1 = $86;
 $87 = $0;
 $88 = $1;
 $89 = HEAP32[$87>>2]|0;
 $90 = (($89) + ($88<<2)|0);
 $91 = HEAP32[$90>>2]|0;
 $92 = HEAP32[$29>>2]|0;
 __ZN15CredictCardBase16addPreAssignBillEP4Bill($91,$92);
 STACKTOP = sp;return;
}
function __ZN14CredictCardMgr7addCardEP15CredictCardBase($this,$card) {
 $this = $this|0;
 $card = $card|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__annotator$i = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp;
 $13 = sp + 96|0;
 $__annotator$i = sp + 97|0;
 $24 = sp + 44|0;
 $23 = $this;
 HEAP32[$24>>2] = $card;
 $25 = $23;
 $21 = $25;
 $22 = $24;
 $26 = $21;
 $27 = ((($26)) + 4|0);
 $28 = HEAP32[$27>>2]|0;
 $20 = $26;
 $29 = $20;
 $30 = ((($29)) + 8|0);
 $19 = $30;
 $31 = $19;
 $18 = $31;
 $32 = $18;
 $33 = HEAP32[$32>>2]|0;
 $34 = ($28|0)!=($33|0);
 if ($34) {
  __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$26,1);
  $17 = $26;
  $35 = $17;
  $36 = ((($35)) + 8|0);
  $16 = $36;
  $37 = $16;
  $15 = $37;
  $38 = $15;
  $39 = ((($26)) + 4|0);
  $40 = HEAP32[$39>>2]|0;
  $14 = $40;
  $41 = $14;
  $42 = $22;
  $10 = $38;
  $11 = $41;
  $12 = $42;
  $43 = $10;
  $44 = $11;
  $45 = $12;
  $9 = $45;
  $46 = $9;
  ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
  $5 = $43;
  $6 = $44;
  $7 = $46;
  $47 = $5;
  $48 = $6;
  $49 = $7;
  $4 = $49;
  $50 = $4;
  $1 = $47;
  $2 = $48;
  $3 = $50;
  $51 = $2;
  $52 = $3;
  $0 = $52;
  $53 = $0;
  $54 = HEAP32[$53>>2]|0;
  HEAP32[$51>>2] = $54;
  __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
  $55 = ((($26)) + 4|0);
  $56 = HEAP32[$55>>2]|0;
  $57 = ((($56)) + 4|0);
  HEAP32[$55>>2] = $57;
  STACKTOP = sp;return;
 } else {
  $58 = $22;
  __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($26,$58);
  STACKTOP = sp;return;
 }
}
function __ZN14CredictCardMgr10assignCardEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $i1 = 0, $i2 = 0, $i3 = 0, $i4 = 0, $iter = 0, $maxIter = 0, $randIdx = 0, $totalDisCount = 0;
 var $vararg_buffer = 0, $vararg_buffer1 = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer1 = sp;
 $vararg_buffer = sp + 8|0;
 $20 = $this;
 $21 = $20;
 $19 = $21;
 $22 = $19;
 $23 = ((($22)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = HEAP32[$22>>2]|0;
 $26 = $24;
 $27 = $25;
 $28 = (($26) - ($27))|0;
 $29 = (($28|0) / 4)&-1;
 $30 = (+($29>>>0));
 $31 = ((($21)) + 12|0);
 $18 = $31;
 $32 = $18;
 $33 = ((($32)) + 4|0);
 $34 = HEAP32[$33>>2]|0;
 $35 = HEAP32[$32>>2]|0;
 $36 = $34;
 $37 = $35;
 $38 = (($36) - ($37))|0;
 $39 = (($38|0) / 4)&-1;
 $40 = (+($39>>>0));
 $41 = (+Math_pow((+$30),(+$40)));
 $42 = 2.0 * $41;
 $43 = (~~(($42))>>>0);
 $maxIter = $43;
 $iter = 0;
 while(1) {
  $44 = $iter;
  $45 = $maxIter;
  $46 = ($44>>>0)<($45>>>0);
  if (!($46)) {
   break;
  }
  $i = 0;
  while(1) {
   $47 = $i;
   $14 = $21;
   $48 = $14;
   $49 = ((($48)) + 4|0);
   $50 = HEAP32[$49>>2]|0;
   $51 = HEAP32[$48>>2]|0;
   $52 = $50;
   $53 = $51;
   $54 = (($52) - ($53))|0;
   $55 = (($54|0) / 4)&-1;
   $56 = ($47>>>0)<($55>>>0);
   if (!($56)) {
    break;
   }
   $57 = $i;
   $9 = $21;
   $10 = $57;
   $58 = $9;
   $59 = $10;
   $60 = HEAP32[$58>>2]|0;
   $61 = (($60) + ($59<<2)|0);
   $62 = HEAP32[$61>>2]|0;
   __ZN15CredictCardBase15clearAssignBillEv($62);
   $63 = $i;
   $64 = (($63) + 1)|0;
   $i = $64;
  }
  $i1 = 0;
  while(1) {
   $65 = $i1;
   $66 = ((($21)) + 12|0);
   $5 = $66;
   $67 = $5;
   $68 = ((($67)) + 4|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = HEAP32[$67>>2]|0;
   $71 = $69;
   $72 = $70;
   $73 = (($71) - ($72))|0;
   $74 = (($73|0) / 4)&-1;
   $75 = ($65>>>0)<($74>>>0);
   if (!($75)) {
    break;
   }
   $76 = (_rand()|0);
   $0 = $21;
   $77 = $0;
   $78 = ((($77)) + 4|0);
   $79 = HEAP32[$78>>2]|0;
   $80 = HEAP32[$77>>2]|0;
   $81 = $79;
   $82 = $80;
   $83 = (($81) - ($82))|0;
   $84 = (($83|0) / 4)&-1;
   $85 = (($76>>>0) % ($84>>>0))&-1;
   $randIdx = $85;
   $86 = $randIdx;
   $1 = $21;
   $2 = $86;
   $87 = $1;
   $88 = $2;
   $89 = HEAP32[$87>>2]|0;
   $90 = (($89) + ($88<<2)|0);
   $91 = HEAP32[$90>>2]|0;
   $92 = ((($21)) + 12|0);
   $93 = $i1;
   $3 = $92;
   $4 = $93;
   $94 = $3;
   $95 = $4;
   $96 = HEAP32[$94>>2]|0;
   $97 = (($96) + ($95<<2)|0);
   $98 = HEAP32[$97>>2]|0;
   __ZN15CredictCardBase13addAssignBillEP4Bill($91,$98);
   $99 = $i1;
   $100 = (($99) + 1)|0;
   $i1 = $100;
  }
  $totalDisCount = 0;
  $i2 = 0;
  while(1) {
   $101 = $i2;
   $6 = $21;
   $102 = $6;
   $103 = ((($102)) + 4|0);
   $104 = HEAP32[$103>>2]|0;
   $105 = HEAP32[$102>>2]|0;
   $106 = $104;
   $107 = $105;
   $108 = (($106) - ($107))|0;
   $109 = (($108|0) / 4)&-1;
   $110 = ($101>>>0)<($109>>>0);
   if (!($110)) {
    break;
   }
   $111 = $i2;
   $7 = $21;
   $8 = $111;
   $112 = $7;
   $113 = $8;
   $114 = HEAP32[$112>>2]|0;
   $115 = (($114) + ($113<<2)|0);
   $116 = HEAP32[$115>>2]|0;
   $117 = HEAP32[$116>>2]|0;
   $118 = ((($117)) + 8|0);
   $119 = HEAP32[$118>>2]|0;
   $120 = (FUNCTION_TABLE_ii[$119 & 255]($116)|0);
   $121 = $totalDisCount;
   $122 = (($121) + ($120))|0;
   $totalDisCount = $122;
   $123 = $i2;
   $124 = (($123) + 1)|0;
   $i2 = $124;
  }
  $125 = $totalDisCount;
  $126 = ((($21)) + 24|0);
  $127 = HEAP32[$126>>2]|0;
  $128 = ($125|0)>($127|0);
  L16: do {
   if ($128) {
    $129 = $totalDisCount;
    $130 = ((($21)) + 24|0);
    HEAP32[$130>>2] = $129;
    $i3 = 0;
    while(1) {
     $131 = $i3;
     $11 = $21;
     $132 = $11;
     $133 = ((($132)) + 4|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = HEAP32[$132>>2]|0;
     $136 = $134;
     $137 = $135;
     $138 = (($136) - ($137))|0;
     $139 = (($138|0) / 4)&-1;
     $140 = ($131>>>0)<($139>>>0);
     if (!($140)) {
      break L16;
     }
     $141 = $i3;
     $12 = $21;
     $13 = $141;
     $142 = $12;
     $143 = $13;
     $144 = HEAP32[$142>>2]|0;
     $145 = (($144) + ($143<<2)|0);
     $146 = HEAP32[$145>>2]|0;
     __ZN15CredictCardBase19commitCurrentAssignEv($146);
     $147 = $i3;
     $148 = (($147) + 1)|0;
     $i3 = $148;
    }
   }
  } while(0);
  $149 = $iter;
  $150 = (($149) + 1)|0;
  $iter = $150;
 }
 $151 = ((($21)) + 24|0);
 $152 = HEAP32[$151>>2]|0;
 HEAP32[$vararg_buffer>>2] = $152;
 (_printf((624|0),($vararg_buffer|0))|0);
 (_printf((648|0),($vararg_buffer1|0))|0);
 $i4 = 0;
 while(1) {
  $153 = $i4;
  $15 = $21;
  $154 = $15;
  $155 = ((($154)) + 4|0);
  $156 = HEAP32[$155>>2]|0;
  $157 = HEAP32[$154>>2]|0;
  $158 = $156;
  $159 = $157;
  $160 = (($158) - ($159))|0;
  $161 = (($160|0) / 4)&-1;
  $162 = ($153>>>0)<($161>>>0);
  if (!($162)) {
   break;
  }
  $163 = $i4;
  $16 = $21;
  $17 = $163;
  $164 = $16;
  $165 = $17;
  $166 = HEAP32[$164>>2]|0;
  $167 = (($166) + ($165<<2)|0);
  $168 = HEAP32[$167>>2]|0;
  __ZN15CredictCardBase14dumpBestAssignEv($168);
  (_printf((648|0),($vararg_buffer3|0))|0);
  $169 = $i4;
  $170 = (($169) + 1)|0;
  $i4 = $170;
 }
 STACKTOP = sp;return;
}
function __ZN10emscripten5enum_I8BillTypeEC2EPKc($this,$name) {
 $this = $this|0;
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $name;
 $2 = (__ZN10emscripten8internal6TypeIDI8BillTypeE3getEv()|0);
 $3 = $1;
 __embind_register_enum(($2|0),($3|0),4,0);
 STACKTOP = sp;return;
}
function __ZN10emscripten5enum_I8BillTypeE5valueEPKcS1_($this,$name,$value) {
 $this = $this|0;
 $name = $name|0;
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $name;
 $2 = $value;
 $3 = $0;
 $4 = (__ZN10emscripten8internal6TypeIDI8BillTypeE3getEv()|0);
 $5 = $1;
 $6 = $2;
 __embind_register_enum_value(($4|0),($5|0),($6|0));
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal11NoBaseClass6verifyI4BillEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI4BillEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI4BillEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI4BillEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI4BillEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorI4BillEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  __ZN4BillD2Ev($1);
  __ZdlPv($1);
 }
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI4BillE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI4BillE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI4BillEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP4BillE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK4BillEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK4BillE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11NoBaseClass3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP4BillEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2592|0);
}
function __ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2584|0);
}
function __ZN10emscripten8internal12getSignatureIvJP4BillEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2576|0);
}
function __ZN10emscripten8internal12operator_newI4BillJiiii8BillTypeNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEEEPT_DpOT0_($args,$args1,$args2,$args3,$args4,$args5) {
 $args = $args|0;
 $args1 = $args1|0;
 $args2 = $args2|0;
 $args3 = $args3|0;
 $args4 = $args4|0;
 $args5 = $args5|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0, $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = sp + 28|0;
 $21 = sp + 100|0;
 $12 = $args;
 $13 = $args1;
 $14 = $args2;
 $15 = $args3;
 $16 = $args4;
 $17 = $args5;
 $22 = (__Znwj(32)|0);
 $$expand_i1_val = 1;
 HEAP8[$21>>0] = $$expand_i1_val;
 $23 = $12;
 $11 = $23;
 $24 = $11;
 $25 = HEAP32[$24>>2]|0;
 $26 = $13;
 $10 = $26;
 $27 = $10;
 $28 = HEAP32[$27>>2]|0;
 $29 = $14;
 $0 = $29;
 $30 = $0;
 $31 = HEAP32[$30>>2]|0;
 $32 = $15;
 $1 = $32;
 $33 = $1;
 $34 = HEAP32[$33>>2]|0;
 $35 = $16;
 $2 = $35;
 $36 = $2;
 $37 = HEAP32[$36>>2]|0;
 $38 = $17;
 $3 = $38;
 $39 = $3;
 $8 = $18;
 $9 = $39;
 $40 = $8;
 $41 = $9;
 $7 = $41;
 $42 = $7;
 ;HEAP32[$40>>2]=HEAP32[$42>>2]|0;HEAP32[$40+4>>2]=HEAP32[$42+4>>2]|0;HEAP32[$40+8>>2]=HEAP32[$42+8>>2]|0;
 $43 = $9;
 $6 = $43;
 $44 = $6;
 $5 = $44;
 $45 = $5;
 $4 = $45;
 $46 = $4;
 $__a$i$i = $46;
 $__i$i$i = 0;
 while(1) {
  $47 = $__i$i$i;
  $48 = ($47>>>0)<(3);
  if (!($48)) {
   break;
  }
  $49 = $__i$i$i;
  $50 = $__a$i$i;
  $51 = (($50) + ($49<<2)|0);
  HEAP32[$51>>2] = 0;
  $52 = $__i$i$i;
  $53 = (($52) + 1)|0;
  $__i$i$i = $53;
 }
 __THREW__ = 0;
 invoke_viiiiiii(92,($22|0),($25|0),($28|0),($31|0),($34|0),($37|0),($18|0));
 $54 = __THREW__; __THREW__ = 0;
 $55 = $54&1;
 if (!($55)) {
  $$expand_i1_val2 = 0;
  HEAP8[$21>>0] = $$expand_i1_val2;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($18);
  STACKTOP = sp;return ($22|0);
 }
 $56 = ___cxa_find_matching_catch()|0;
 $57 = tempRet0;
 $19 = $56;
 $20 = $57;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($18);
 $$pre_trunc = HEAP8[$21>>0]|0;
 $58 = $$pre_trunc&1;
 if (!($58)) {
  $59 = $19;
  $60 = $20;
  ___resumeException($59|0);
  // unreachable;
 }
 __ZdlPv($22);
 $59 = $19;
 $60 = $20;
 ___resumeException($59|0);
 // unreachable;
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP4BillJOiS4_S4_S4_O8BillTypeONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE6invokeEPFS3_S4_S4_S4_S4_S6_SE_EiiiiS5_PNS0_11BindingTypeISD_EUt_E($fn,$args,$args1,$args2,$args3,$args4,$args5) {
 $fn = $fn|0;
 $args = $args|0;
 $args1 = $args1|0;
 $args2 = $args2|0;
 $args3 = $args3|0;
 $args4 = $args4|0;
 $args5 = $args5|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $7 = sp + 36|0;
 $8 = sp + 28|0;
 $9 = sp + 24|0;
 $10 = sp + 20|0;
 $11 = sp + 16|0;
 $12 = sp + 4|0;
 $0 = $fn;
 $1 = $args;
 $2 = $args1;
 $3 = $args2;
 $4 = $args3;
 $5 = $args4;
 $6 = $args5;
 $15 = $0;
 $16 = $1;
 $17 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($16)|0);
 HEAP32[$7>>2] = $17;
 $18 = $2;
 $19 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($18)|0);
 HEAP32[$8>>2] = $19;
 $20 = $3;
 $21 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($20)|0);
 HEAP32[$9>>2] = $21;
 $22 = $4;
 $23 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($22)|0);
 HEAP32[$10>>2] = $23;
 $24 = $5;
 $25 = (__ZN10emscripten8internal11BindingTypeIO8BillTypeE12fromWireTypeES2_($24)|0);
 HEAP32[$11>>2] = $25;
 $26 = $6;
 __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($12,$26);
 __THREW__ = 0;
 $27 = (invoke_iiiiiii($15|0,($7|0),($8|0),($9|0),($10|0),($11|0),($12|0))|0);
 $28 = __THREW__; __THREW__ = 0;
 $29 = $28&1;
 if ($29) {
  $33 = ___cxa_find_matching_catch()|0;
  $34 = tempRet0;
  $13 = $33;
  $14 = $34;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($12);
  $35 = $13;
  $36 = $14;
  ___resumeException($35|0);
  // unreachable;
 }
 __THREW__ = 0;
 $30 = (invoke_ii(93,($27|0))|0);
 $31 = __THREW__; __THREW__ = 0;
 $32 = $31&1;
 if ($32) {
  $33 = ___cxa_find_matching_catch()|0;
  $34 = tempRet0;
  $13 = $33;
  $14 = $34;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($12);
  $35 = $13;
  $36 = $14;
  ___resumeException($35|0);
  // unreachable;
 } else {
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($12);
  STACKTOP = sp;return ($30|0);
 }
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP4BillOiS7_S7_S7_O8BillTypeONSt3__112basic_stringIcNSA_11char_traitsIcEENSA_9allocatorIcEEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 7;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP4BillOiS7_S7_S7_O8BillTypeONSt3__112basic_stringIcNSA_11char_traitsIcEENSA_9allocatorIcEEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI4BillEEOiS6_S6_S6_O8BillTypeONSt3__112basic_stringIcNS9_11char_traitsIcEENS9_9allocatorIcEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP4BillJPFS3_OiS4_S4_S4_O8BillTypeONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEiiiiS5_PNS0_11BindingTypeISD_EUt_EEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2528|0);
}
function __ZN4Bill9getAmountEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 12|0);
 $3 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal13MethodInvokerIM4BillFivEiPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI4BillEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI4BillEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIiJRKM4BillFivEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2512|0);
}
function __ZN10emscripten8internal10getContextIM4BillFivEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN4Bill7getTypeEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal13MethodInvokerIM4BillF8BillTypevES3_PS2_JEE6invokeERKS5_S6_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $3 = $1;
 $4 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($3)|0);
 $5 = $$field2 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$field2 & 1;
 $8 = ($7|0)!=(0);
 if ($8) {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$field)|0);
  $11 = HEAP32[$10>>2]|0;
  $13 = $11;
 } else {
  $12 = $$field;
  $13 = $12;
 }
 $14 = (FUNCTION_TABLE_ii[$13 & 255]($6)|0);
 $15 = (__ZN10emscripten8internal15EnumBindingTypeI8BillTypeE10toWireTypeES2_($14)|0);
 STACKTOP = sp;return ($15|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureI8BillTypeJRKM4BillFS2_vEPS3_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2472|0);
}
function __ZN10emscripten8internal10getContextIM4BillF8BillTypevEEEPT_RKS6_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN4Bill4infoEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, $vararg_ptr5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $15 = $this;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = ((($16)) + 4|0);
 $19 = HEAP32[$18>>2]|0;
 $20 = ((($16)) + 8|0);
 $21 = HEAP32[$20>>2]|0;
 $22 = ((($16)) + 12|0);
 $23 = HEAP32[$22>>2]|0;
 $24 = ((($16)) + 16|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = ((($16)) + 20|0);
 $14 = $26;
 $27 = $14;
 $13 = $27;
 $28 = $13;
 $12 = $28;
 $29 = $12;
 $11 = $29;
 $30 = $11;
 $10 = $30;
 $31 = $10;
 $9 = $31;
 $32 = $9;
 $33 = HEAP8[$32>>0]|0;
 $34 = $33&255;
 $35 = $34 & 1;
 $36 = ($35|0)!=(0);
 if ($36) {
  $3 = $29;
  $37 = $3;
  $2 = $37;
  $38 = $2;
  $1 = $38;
  $39 = $1;
  $40 = ((($39)) + 8|0);
  $41 = HEAP32[$40>>2]|0;
  $48 = $41;
 } else {
  $8 = $29;
  $42 = $8;
  $7 = $42;
  $43 = $7;
  $6 = $43;
  $44 = $6;
  $45 = ((($44)) + 1|0);
  $5 = $45;
  $46 = $5;
  $4 = $46;
  $47 = $4;
  $48 = $47;
 }
 $0 = $48;
 $49 = $0;
 HEAP32[$vararg_buffer>>2] = $17;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $19;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $21;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $23;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $25;
 $vararg_ptr5 = ((($vararg_buffer)) + 20|0);
 HEAP32[$vararg_ptr5>>2] = $49;
 (_printf((2400|0),($vararg_buffer|0))|0);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal13MethodInvokerIM4BillFvvEvPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $3 = $1;
 $4 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($3)|0);
 $5 = $$field2 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$field2 & 1;
 $8 = ($7|0)!=(0);
 if ($8) {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$field)|0);
  $11 = HEAP32[$10>>2]|0;
  $13 = $11;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 } else {
  $12 = $$field;
  $13 = $12;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 }
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI4BillEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI4BillEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI4BillEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM4BillFvvEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2384|0);
}
function __ZN10emscripten8internal10getContextIM4BillFvvEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten15register_vectorIP4BillEENS_6class_INSt3__16vectorIT_NS4_9allocatorIS6_EEEENS_8internal11NoBaseClassEEEPKc($agg$result,$name) {
 $agg$result = $agg$result|0;
 $name = $name|0;
 var $$field = 0, $$field14 = 0, $$field17 = 0, $$field4 = 0, $$index12 = 0, $$index16 = 0, $$index20 = 0, $$index25 = 0, $$index27 = 0, $$index3 = 0, $$index32 = 0, $$index7 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0;
 var $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $_getActualType$i = 0, $args$i = 0, $args$i$i = 0, $args$i2 = 0, $args$i5 = 0, $args$i7 = 0, $args$i8 = 0;
 var $destructor$i = 0, $downcast$i = 0, $invoke$i = 0, $invoke$i$i = 0, $invoke$i9 = 0, $invoker$i = 0, $invoker$i1 = 0, $invoker$i4 = 0, $memberFunction$i$field = 0, $memberFunction$i$field9 = 0, $memberFunction$i$index8 = 0, $memberFunction$i3$field = 0, $memberFunction$i3$field22 = 0, $memberFunction$i3$index21 = 0, $memberFunction$i6$field = 0, $memberFunction$i6$field29 = 0, $memberFunction$i6$index28 = 0, $push_back = 0, $push_back$index1 = 0, $resize = 0;
 var $resize$index2 = 0, $upcast$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 172|0;
 $args$i8 = sp + 209|0;
 $5 = sp + 152|0;
 $args$i7 = sp + 213|0;
 $8 = sp + 136|0;
 $args$i5 = sp + 212|0;
 $9 = sp + 8|0;
 $12 = sp + 192|0;
 $args$i2 = sp + 211|0;
 $13 = sp;
 $16 = sp + 48|0;
 $args$i = sp + 208|0;
 $17 = sp + 16|0;
 $args$i$i = sp + 214|0;
 $push_back = sp + 96|0;
 $resize = sp + 104|0;
 $24 = sp + 210|0;
 $25 = sp + 112|0;
 $26 = sp + 120|0;
 $27 = sp + 128|0;
 $23 = $name;
 HEAP32[$push_back>>2] = (94);
 $push_back$index1 = ((($push_back)) + 4|0);
 HEAP32[$push_back$index1>>2] = 0;
 HEAP32[$resize>>2] = (95);
 $resize$index2 = ((($resize)) + 4|0);
 HEAP32[$resize$index2>>2] = 0;
 $28 = $23;
 $21 = $24;
 $22 = $28;
 __ZN10emscripten8internal11NoBaseClass6verifyINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEvv();
 $_getActualType$i = 96;
 $29 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEPFvvEv()|0);
 $upcast$i = $29;
 $30 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEPFvvEv()|0);
 $downcast$i = $30;
 $destructor$i = 97;
 $31 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $32 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEE3getEv()|0);
 $33 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEE3getEv()|0);
 $34 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $35 = $_getActualType$i;
 $36 = (__ZN10emscripten8internal12getSignatureIPKvJPNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEPKcPFT_DpT0_E($35)|0);
 $37 = $_getActualType$i;
 $38 = $upcast$i;
 $39 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($38)|0);
 $40 = $upcast$i;
 $41 = $downcast$i;
 $42 = (__ZN10emscripten8internal12getSignatureIvJEEEPKcPFT_DpT0_E($41)|0);
 $43 = $downcast$i;
 $44 = $22;
 $45 = $destructor$i;
 $46 = (__ZN10emscripten8internal12getSignatureIvJPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEEPKcPFT_DpT0_E($45)|0);
 $47 = $destructor$i;
 __embind_register_class(($31|0),($32|0),($33|0),($34|0),($36|0),($37|0),($39|0),($40|0),($42|0),($43|0),($44|0),($46|0),($47|0));
 $20 = $24;
 $48 = $20;
 $18 = $48;
 $19 = 98;
 $49 = $18;
 $invoke$i$i = 99;
 $50 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $51 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEE8getCountEv($args$i$i)|0);
 $52 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEE8getTypesEv($args$i$i)|0);
 $53 = $invoke$i$i;
 $54 = (__ZN10emscripten8internal12getSignatureIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJPFS9_vEEEEPKcPFT_DpT0_E($53)|0);
 $55 = $invoke$i$i;
 $56 = $19;
 __embind_register_class_constructor(($50|0),($51|0),($52|0),($54|0),($55|0),($56|0));
 $$field = HEAP32[$push_back>>2]|0;
 $$index3 = ((($push_back)) + 4|0);
 $$field4 = HEAP32[$$index3>>2]|0;
 HEAP32[$25>>2] = $$field;
 $$index7 = ((($25)) + 4|0);
 HEAP32[$$index7>>2] = $$field4;
 ;HEAP8[$17>>0]=HEAP8[$25>>0]|0;HEAP8[$17+1>>0]=HEAP8[$25+1>>0]|0;HEAP8[$17+2>>0]=HEAP8[$25+2>>0]|0;HEAP8[$17+3>>0]=HEAP8[$25+3>>0]|0;HEAP8[$17+4>>0]=HEAP8[$25+4>>0]|0;HEAP8[$17+5>>0]=HEAP8[$25+5>>0]|0;HEAP8[$17+6>>0]=HEAP8[$25+6>>0]|0;HEAP8[$17+7>>0]=HEAP8[$25+7>>0]|0;
 $memberFunction$i$field = HEAP32[$17>>2]|0;
 $memberFunction$i$index8 = ((($17)) + 4|0);
 $memberFunction$i$field9 = HEAP32[$memberFunction$i$index8>>2]|0;
 $14 = $49;
 $15 = 2032;
 HEAP32[$16>>2] = $memberFunction$i$field;
 $$index12 = ((($16)) + 4|0);
 HEAP32[$$index12>>2] = $memberFunction$i$field9;
 $57 = $14;
 $invoker$i = 100;
 $58 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $59 = $15;
 $60 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEERKS8_EE8getCountEv($args$i)|0);
 $61 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEERKS8_EE8getTypesEv($args$i)|0);
 $62 = $invoker$i;
 $63 = (__ZN10emscripten8internal12getSignatureIvJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EPS8_S5_EEEPKcPFT_DpT0_E($62)|0);
 $64 = $invoker$i;
 $65 = (__ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EEEPT_RKSD_($16)|0);
 __embind_register_class_function(($58|0),($59|0),($60|0),($61|0),($63|0),($64|0),($65|0),0);
 $$field14 = HEAP32[$resize>>2]|0;
 $$index16 = ((($resize)) + 4|0);
 $$field17 = HEAP32[$$index16>>2]|0;
 HEAP32[$26>>2] = $$field14;
 $$index20 = ((($26)) + 4|0);
 HEAP32[$$index20>>2] = $$field17;
 ;HEAP8[$13>>0]=HEAP8[$26>>0]|0;HEAP8[$13+1>>0]=HEAP8[$26+1>>0]|0;HEAP8[$13+2>>0]=HEAP8[$26+2>>0]|0;HEAP8[$13+3>>0]=HEAP8[$26+3>>0]|0;HEAP8[$13+4>>0]=HEAP8[$26+4>>0]|0;HEAP8[$13+5>>0]=HEAP8[$26+5>>0]|0;HEAP8[$13+6>>0]=HEAP8[$26+6>>0]|0;HEAP8[$13+7>>0]=HEAP8[$26+7>>0]|0;
 $memberFunction$i3$field = HEAP32[$13>>2]|0;
 $memberFunction$i3$index21 = ((($13)) + 4|0);
 $memberFunction$i3$field22 = HEAP32[$memberFunction$i3$index21>>2]|0;
 $10 = $57;
 $11 = 2048;
 HEAP32[$12>>2] = $memberFunction$i3$field;
 $$index25 = ((($12)) + 4|0);
 HEAP32[$$index25>>2] = $memberFunction$i3$field22;
 $66 = $10;
 $invoker$i1 = 101;
 $67 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $68 = $11;
 $69 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEjRKS8_EE8getCountEv($args$i2)|0);
 $70 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEjRKS8_EE8getTypesEv($args$i2)|0);
 $71 = $invoker$i1;
 $72 = (__ZN10emscripten8internal12getSignatureIvJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EPS8_jS5_EEEPKcPFT_DpT0_E($71)|0);
 $73 = $invoker$i1;
 $74 = (__ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EEEPT_RKSD_($12)|0);
 __embind_register_class_function(($67|0),($68|0),($69|0),($70|0),($72|0),($73|0),($74|0),0);
 HEAP32[$27>>2] = (102);
 $$index27 = ((($27)) + 4|0);
 HEAP32[$$index27>>2] = 0;
 ;HEAP8[$9>>0]=HEAP8[$27>>0]|0;HEAP8[$9+1>>0]=HEAP8[$27+1>>0]|0;HEAP8[$9+2>>0]=HEAP8[$27+2>>0]|0;HEAP8[$9+3>>0]=HEAP8[$27+3>>0]|0;HEAP8[$9+4>>0]=HEAP8[$27+4>>0]|0;HEAP8[$9+5>>0]=HEAP8[$27+5>>0]|0;HEAP8[$9+6>>0]=HEAP8[$27+6>>0]|0;HEAP8[$9+7>>0]=HEAP8[$27+7>>0]|0;
 $memberFunction$i6$field = HEAP32[$9>>2]|0;
 $memberFunction$i6$index28 = ((($9)) + 4|0);
 $memberFunction$i6$field29 = HEAP32[$memberFunction$i6$index28>>2]|0;
 $6 = $66;
 $7 = 2056;
 HEAP32[$8>>2] = $memberFunction$i6$field;
 $$index32 = ((($8)) + 4|0);
 HEAP32[$$index32>>2] = $memberFunction$i6$field29;
 $75 = $6;
 $invoker$i4 = 103;
 $76 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $77 = $7;
 $78 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEEE8getCountEv($args$i5)|0);
 $79 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEEE8getTypesEv($args$i5)|0);
 $80 = $invoker$i4;
 $81 = (__ZN10emscripten8internal12getSignatureIjJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEPKS8_EEEPKcPFT_DpT0_E($80)|0);
 $82 = $invoker$i4;
 $83 = (__ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEEEPT_RKSB_($8)|0);
 __embind_register_class_function(($76|0),($77|0),($78|0),($79|0),($81|0),($82|0),($83|0),0);
 $3 = $75;
 $4 = 2064;
 HEAP32[$5>>2] = 104;
 $84 = $3;
 $invoke$i = 105;
 $85 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $86 = $4;
 $87 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEE8getCountEv($args$i7)|0);
 $88 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEE8getTypesEv($args$i7)|0);
 $89 = $invoke$i;
 $90 = (__ZN10emscripten8internal12getSignatureIPNS0_7_EM_VALEJPPFNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEPSB_jEEEPKcPFT_DpT0_E($89)|0);
 $91 = $invoke$i;
 $92 = (__ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjEEEPT_RKSE_($5)|0);
 __embind_register_class_function(($85|0),($86|0),($87|0),($88|0),($90|0),($91|0),($92|0),0);
 $0 = $84;
 $1 = 2072;
 HEAP32[$2>>2] = 106;
 $invoke$i9 = 107;
 $93 = (__ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 $94 = $1;
 $95 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjRKS7_EE8getCountEv($args$i8)|0);
 $96 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjRKS7_EE8getTypesEv($args$i8)|0);
 $97 = $invoke$i9;
 $98 = (__ZN10emscripten8internal12getSignatureIbJPPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EPS8_jS5_EEEPKcPFT_DpT0_E($97)|0);
 $99 = $invoke$i9;
 $100 = (__ZN10emscripten8internal10getContextIPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EEEPT_RKSE_($2)|0);
 __embind_register_class_function(($93|0),($94|0),($95|0),($96|0),($98|0),($99|0),($100|0),0);
 STACKTOP = sp;return;
}
function __ZN15CredictCardBase13_getMergeListERNSt3__16vectorIP4BillNS0_9allocatorIS3_EEEE($this,$mergeList) {
 $this = $this|0;
 $mergeList = $mergeList|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0;
 var $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__annotator$i = 0, $__annotator$i2 = 0, $__old_size$i = 0, $i = 0, $i1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 304|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $11 = sp + 16|0;
 $16 = sp + 300|0;
 $__annotator$i2 = sp + 297|0;
 $34 = sp;
 $39 = sp + 296|0;
 $__annotator$i = sp + 298|0;
 $57 = sp + 8|0;
 $60 = sp + 299|0;
 $70 = $this;
 $71 = $mergeList;
 $72 = $70;
 $73 = $71;
 $69 = $73;
 $74 = $69;
 $68 = $74;
 $75 = $68;
 $76 = ((($75)) + 4|0);
 $77 = HEAP32[$76>>2]|0;
 $78 = HEAP32[$75>>2]|0;
 $79 = $77;
 $80 = $78;
 $81 = (($79) - ($80))|0;
 $82 = (($81|0) / 4)&-1;
 $__old_size$i = $82;
 $67 = $74;
 $83 = $67;
 $84 = HEAP32[$83>>2]|0;
 $65 = $83;
 $66 = $84;
 $85 = $65;
 while(1) {
  $86 = $66;
  $87 = ((($85)) + 4|0);
  $88 = HEAP32[$87>>2]|0;
  $89 = ($86|0)!=($88|0);
  if (!($89)) {
   break;
  }
  $64 = $85;
  $90 = $64;
  $91 = ((($90)) + 8|0);
  $63 = $91;
  $92 = $63;
  $62 = $92;
  $93 = $62;
  $94 = ((($85)) + 4|0);
  $95 = HEAP32[$94>>2]|0;
  $96 = ((($95)) + -4|0);
  HEAP32[$94>>2] = $96;
  $61 = $96;
  $97 = $61;
  $58 = $93;
  $59 = $97;
  $98 = $58;
  $99 = $59;
  ;HEAP8[$57>>0]=HEAP8[$60>>0]|0;
  $55 = $98;
  $56 = $99;
  $100 = $55;
  $101 = $56;
  $53 = $100;
  $54 = $101;
 }
 $102 = $__old_size$i;
 __THREW__ = 0;
 invoke_vii(108,($74|0),($102|0));
 $103 = __THREW__; __THREW__ = 0;
 $104 = $103&1;
 if ($104) {
  $105 = ___cxa_find_matching_catch(0|0)|0;
  $106 = tempRet0;
  ___clang_call_terminate($105);
  // unreachable;
 }
 $52 = $74;
 $i = 0;
 while(1) {
  $107 = $i;
  $108 = ((($72)) + 12|0);
  $51 = $108;
  $109 = $51;
  $110 = ((($109)) + 4|0);
  $111 = HEAP32[$110>>2]|0;
  $112 = HEAP32[$109>>2]|0;
  $113 = $111;
  $114 = $112;
  $115 = (($113) - ($114))|0;
  $116 = (($115|0) / 4)&-1;
  $117 = ($107>>>0)<($116>>>0);
  if (!($117)) {
   break;
  }
  $118 = $71;
  $119 = ((($72)) + 12|0);
  $120 = $i;
  $49 = $119;
  $50 = $120;
  $121 = $49;
  $122 = $50;
  $123 = HEAP32[$121>>2]|0;
  $124 = (($123) + ($122<<2)|0);
  $24 = $118;
  $25 = $124;
  $125 = $24;
  $126 = ((($125)) + 4|0);
  $127 = HEAP32[$126>>2]|0;
  $23 = $125;
  $128 = $23;
  $129 = ((($128)) + 8|0);
  $22 = $129;
  $130 = $22;
  $21 = $130;
  $131 = $21;
  $132 = HEAP32[$131>>2]|0;
  $133 = ($127|0)!=($132|0);
  if ($133) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i2,$125,1);
   $20 = $125;
   $134 = $20;
   $135 = ((($134)) + 8|0);
   $19 = $135;
   $136 = $19;
   $18 = $136;
   $137 = $18;
   $138 = ((($125)) + 4|0);
   $139 = HEAP32[$138>>2]|0;
   $17 = $139;
   $140 = $17;
   $141 = $25;
   $13 = $137;
   $14 = $140;
   $15 = $141;
   $142 = $13;
   $143 = $14;
   $144 = $15;
   $12 = $144;
   $145 = $12;
   ;HEAP8[$11>>0]=HEAP8[$16>>0]|0;
   $8 = $142;
   $9 = $143;
   $10 = $145;
   $146 = $8;
   $147 = $9;
   $148 = $10;
   $7 = $148;
   $149 = $7;
   $4 = $146;
   $5 = $147;
   $6 = $149;
   $150 = $5;
   $151 = $6;
   $3 = $151;
   $152 = $3;
   $153 = HEAP32[$152>>2]|0;
   HEAP32[$150>>2] = $153;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i2);
   $154 = ((($125)) + 4|0);
   $155 = HEAP32[$154>>2]|0;
   $156 = ((($155)) + 4|0);
   HEAP32[$154>>2] = $156;
  } else {
   $157 = $25;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($125,$157);
  }
  $158 = $i;
  $159 = (($158) + 1)|0;
  $i = $159;
 }
 $i1 = 0;
 while(1) {
  $160 = $i1;
  $161 = ((($72)) + 24|0);
  $2 = $161;
  $162 = $2;
  $163 = ((($162)) + 4|0);
  $164 = HEAP32[$163>>2]|0;
  $165 = HEAP32[$162>>2]|0;
  $166 = $164;
  $167 = $165;
  $168 = (($166) - ($167))|0;
  $169 = (($168|0) / 4)&-1;
  $170 = ($160>>>0)<($169>>>0);
  if (!($170)) {
   break;
  }
  $171 = $71;
  $172 = ((($72)) + 24|0);
  $173 = $i1;
  $0 = $172;
  $1 = $173;
  $174 = $0;
  $175 = $1;
  $176 = HEAP32[$174>>2]|0;
  $177 = (($176) + ($175<<2)|0);
  $47 = $171;
  $48 = $177;
  $178 = $47;
  $179 = ((($178)) + 4|0);
  $180 = HEAP32[$179>>2]|0;
  $46 = $178;
  $181 = $46;
  $182 = ((($181)) + 8|0);
  $45 = $182;
  $183 = $45;
  $44 = $183;
  $184 = $44;
  $185 = HEAP32[$184>>2]|0;
  $186 = ($180|0)!=($185|0);
  if ($186) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$178,1);
   $43 = $178;
   $187 = $43;
   $188 = ((($187)) + 8|0);
   $42 = $188;
   $189 = $42;
   $41 = $189;
   $190 = $41;
   $191 = ((($178)) + 4|0);
   $192 = HEAP32[$191>>2]|0;
   $40 = $192;
   $193 = $40;
   $194 = $48;
   $36 = $190;
   $37 = $193;
   $38 = $194;
   $195 = $36;
   $196 = $37;
   $197 = $38;
   $35 = $197;
   $198 = $35;
   ;HEAP8[$34>>0]=HEAP8[$39>>0]|0;
   $31 = $195;
   $32 = $196;
   $33 = $198;
   $199 = $31;
   $200 = $32;
   $201 = $33;
   $30 = $201;
   $202 = $30;
   $27 = $199;
   $28 = $200;
   $29 = $202;
   $203 = $28;
   $204 = $29;
   $26 = $204;
   $205 = $26;
   $206 = HEAP32[$205>>2]|0;
   HEAP32[$203>>2] = $206;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
   $207 = ((($178)) + 4|0);
   $208 = HEAP32[$207>>2]|0;
   $209 = ((($208)) + 4|0);
   HEAP32[$207>>2] = $209;
  } else {
   $210 = $48;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($178,$210);
  }
  $211 = $i1;
  $212 = (($211) + 1)|0;
  $i1 = $212;
 }
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZNSt3__113__vector_baseIP4BillNS_9allocatorIS2_EEED2Ev($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal11NoBaseClass6verifyI15CredictCardBaseEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI15CredictCardBaseEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI15CredictCardBaseEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI15CredictCardBaseEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI15CredictCardBaseEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorI15CredictCardBaseEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  STACKTOP = sp;return;
 }
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 FUNCTION_TABLE_vi[$5 & 255]($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI15CredictCardBaseE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI15CredictCardBaseEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP15CredictCardBaseE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK15CredictCardBaseEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK15CredictCardBaseE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP15CredictCardBaseEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1984|0);
}
function __ZN10emscripten8internal12getSignatureIvJP15CredictCardBaseEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1976|0);
}
function __ZN10emscripten8internal12operator_newI15CredictCardBaseJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEiEEEPT_DpOT0_($args,$args1) {
 $args = $args|0;
 $args1 = $args1|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0, $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $10 = sp + 8|0;
 $13 = sp + 68|0;
 $8 = $args;
 $9 = $args1;
 $14 = (__Znwj(60)|0);
 $$expand_i1_val = 1;
 HEAP8[$13>>0] = $$expand_i1_val;
 $15 = $8;
 $7 = $15;
 $16 = $7;
 $5 = $10;
 $6 = $16;
 $17 = $5;
 $18 = $6;
 $4 = $18;
 $19 = $4;
 ;HEAP32[$17>>2]=HEAP32[$19>>2]|0;HEAP32[$17+4>>2]=HEAP32[$19+4>>2]|0;HEAP32[$17+8>>2]=HEAP32[$19+8>>2]|0;
 $20 = $6;
 $3 = $20;
 $21 = $3;
 $2 = $21;
 $22 = $2;
 $1 = $22;
 $23 = $1;
 $__a$i$i = $23;
 $__i$i$i = 0;
 while(1) {
  $24 = $__i$i$i;
  $25 = ($24>>>0)<(3);
  if (!($25)) {
   break;
  }
  $26 = $__i$i$i;
  $27 = $__a$i$i;
  $28 = (($27) + ($26<<2)|0);
  HEAP32[$28>>2] = 0;
  $29 = $__i$i$i;
  $30 = (($29) + 1)|0;
  $__i$i$i = $30;
 }
 $31 = $9;
 $0 = $31;
 $32 = $0;
 $33 = HEAP32[$32>>2]|0;
 __THREW__ = 0;
 invoke_viii(109,($14|0),($10|0),($33|0));
 $34 = __THREW__; __THREW__ = 0;
 $35 = $34&1;
 if (!($35)) {
  $$expand_i1_val2 = 0;
  HEAP8[$13>>0] = $$expand_i1_val2;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($10);
  STACKTOP = sp;return ($14|0);
 }
 $36 = ___cxa_find_matching_catch()|0;
 $37 = tempRet0;
 $11 = $36;
 $12 = $37;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($10);
 $$pre_trunc = HEAP8[$13>>0]|0;
 $38 = $$pre_trunc&1;
 if (!($38)) {
  $39 = $11;
  $40 = $12;
  ___resumeException($39|0);
  // unreachable;
 }
 __ZdlPv($14);
 $39 = $11;
 $40 = $12;
 ___resumeException($39|0);
 // unreachable;
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP15CredictCardBaseJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEOiEE6invokeEPFS3_SB_SC_EPNS0_11BindingTypeISA_EUt_Ei($fn,$args,$args1) {
 $fn = $fn|0;
 $args = $args|0;
 $args1 = $args1|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 8|0;
 $4 = sp + 20|0;
 $0 = $fn;
 $1 = $args;
 $2 = $args1;
 $7 = $0;
 $8 = $1;
 __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($3,$8);
 $9 = $2;
 __THREW__ = 0;
 $10 = (invoke_ii(110,($9|0))|0);
 $11 = __THREW__; __THREW__ = 0;
 $12 = $11&1;
 if (!($12)) {
  HEAP32[$4>>2] = $10;
  __THREW__ = 0;
  $13 = (invoke_iii($7|0,($3|0),($4|0))|0);
  $14 = __THREW__; __THREW__ = 0;
  $15 = $14&1;
  if (!($15)) {
   __THREW__ = 0;
   $16 = (invoke_ii(111,($13|0))|0);
   $17 = __THREW__; __THREW__ = 0;
   $18 = $17&1;
   if (!($18)) {
    __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($3);
    STACKTOP = sp;return ($16|0);
   }
  }
 }
 $19 = ___cxa_find_matching_catch()|0;
 $20 = tempRet0;
 $5 = $19;
 $6 = $20;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($3);
 $21 = $5;
 $22 = $6;
 ___resumeException($21|0);
 // unreachable;
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15CredictCardBaseONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEOiEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP15CredictCardBaseONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEOiEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI15CredictCardBaseEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEOiEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP15CredictCardBaseJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEOiEPNS0_11BindingTypeISA_EUt_EiEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1952|0);
}
function __ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFivEiPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_12pure_virtualEEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_12pure_virtualEEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIiJRKM15CredictCardBaseFivEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1944|0);
}
function __ZN10emscripten8internal10getContextIM15CredictCardBaseFivEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN15CredictCardBase16addPreAssignBillEP4Bill($this,$b) {
 $this = $this|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $__annotator$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp;
 $13 = sp + 96|0;
 $__annotator$i = sp + 97|0;
 $24 = sp + 44|0;
 $23 = $this;
 HEAP32[$24>>2] = $b;
 $25 = $23;
 $26 = ((($25)) + 12|0);
 $21 = $26;
 $22 = $24;
 $27 = $21;
 $28 = ((($27)) + 4|0);
 $29 = HEAP32[$28>>2]|0;
 $20 = $27;
 $30 = $20;
 $31 = ((($30)) + 8|0);
 $19 = $31;
 $32 = $19;
 $18 = $32;
 $33 = $18;
 $34 = HEAP32[$33>>2]|0;
 $35 = ($29|0)!=($34|0);
 if ($35) {
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$27,1);
  $17 = $27;
  $36 = $17;
  $37 = ((($36)) + 8|0);
  $16 = $37;
  $38 = $16;
  $15 = $38;
  $39 = $15;
  $40 = ((($27)) + 4|0);
  $41 = HEAP32[$40>>2]|0;
  $14 = $41;
  $42 = $14;
  $43 = $22;
  $10 = $39;
  $11 = $42;
  $12 = $43;
  $44 = $10;
  $45 = $11;
  $46 = $12;
  $9 = $46;
  $47 = $9;
  ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
  $5 = $44;
  $6 = $45;
  $7 = $47;
  $48 = $5;
  $49 = $6;
  $50 = $7;
  $4 = $50;
  $51 = $4;
  $1 = $48;
  $2 = $49;
  $3 = $51;
  $52 = $2;
  $53 = $3;
  $0 = $53;
  $54 = $0;
  $55 = HEAP32[$54>>2]|0;
  HEAP32[$52>>2] = $55;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
  $56 = ((($27)) + 4|0);
  $57 = HEAP32[$56>>2]|0;
  $58 = ((($57)) + 4|0);
  HEAP32[$56>>2] = $58;
  STACKTOP = sp;return;
 } else {
  $59 = $22;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($27,$59);
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvP4BillEvPS2_JS4_EE6invokeERKS6_S7_S4_($method,$wireThis,$args) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $16 = $12;
 } else {
  $13 = $$field;
  $16 = $13;
 }
 $14 = $2;
 $15 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($14)|0);
 FUNCTION_TABLE_vii[$16 & 255]($7,$15);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEP4BillEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEENS3_I4BillEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvP4BillEPS2_S4_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1920|0);
}
function __ZN10emscripten8internal10getContextIM15CredictCardBaseFvP4BillEEEPT_RKS7_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN15CredictCardBase13addAssignBillEP4Bill($this,$b) {
 $this = $this|0;
 $b = $b|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $__annotator$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp;
 $13 = sp + 96|0;
 $__annotator$i = sp + 97|0;
 $24 = sp + 44|0;
 $23 = $this;
 HEAP32[$24>>2] = $b;
 $25 = $23;
 $26 = ((($25)) + 24|0);
 $21 = $26;
 $22 = $24;
 $27 = $21;
 $28 = ((($27)) + 4|0);
 $29 = HEAP32[$28>>2]|0;
 $20 = $27;
 $30 = $20;
 $31 = ((($30)) + 8|0);
 $19 = $31;
 $32 = $19;
 $18 = $32;
 $33 = $18;
 $34 = HEAP32[$33>>2]|0;
 $35 = ($29|0)!=($34|0);
 if ($35) {
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$27,1);
  $17 = $27;
  $36 = $17;
  $37 = ((($36)) + 8|0);
  $16 = $37;
  $38 = $16;
  $15 = $38;
  $39 = $15;
  $40 = ((($27)) + 4|0);
  $41 = HEAP32[$40>>2]|0;
  $14 = $41;
  $42 = $14;
  $43 = $22;
  $10 = $39;
  $11 = $42;
  $12 = $43;
  $44 = $10;
  $45 = $11;
  $46 = $12;
  $9 = $46;
  $47 = $9;
  ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
  $5 = $44;
  $6 = $45;
  $7 = $47;
  $48 = $5;
  $49 = $6;
  $50 = $7;
  $4 = $50;
  $51 = $4;
  $1 = $48;
  $2 = $49;
  $3 = $51;
  $52 = $2;
  $53 = $3;
  $0 = $53;
  $54 = $0;
  $55 = HEAP32[$54>>2]|0;
  HEAP32[$52>>2] = $55;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
  $56 = ((($27)) + 4|0);
  $57 = HEAP32[$56>>2]|0;
  $58 = ((($57)) + 4|0);
  HEAP32[$56>>2] = $58;
  STACKTOP = sp;return;
 } else {
  $59 = $22;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($27,$59);
  STACKTOP = sp;return;
 }
}
function __ZN15CredictCardBase15clearAssignBillEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__old_size$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $8 = sp + 76|0;
 $18 = $this;
 $19 = $18;
 $20 = ((($19)) + 24|0);
 $17 = $20;
 $21 = $17;
 $16 = $21;
 $22 = $16;
 $23 = ((($22)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = HEAP32[$22>>2]|0;
 $26 = $24;
 $27 = $25;
 $28 = (($26) - ($27))|0;
 $29 = (($28|0) / 4)&-1;
 $__old_size$i = $29;
 $15 = $21;
 $30 = $15;
 $31 = HEAP32[$30>>2]|0;
 $13 = $30;
 $14 = $31;
 $32 = $13;
 while(1) {
  $33 = $14;
  $34 = ((($32)) + 4|0);
  $35 = HEAP32[$34>>2]|0;
  $36 = ($33|0)!=($35|0);
  if (!($36)) {
   break;
  }
  $12 = $32;
  $37 = $12;
  $38 = ((($37)) + 8|0);
  $11 = $38;
  $39 = $11;
  $10 = $39;
  $40 = $10;
  $41 = ((($32)) + 4|0);
  $42 = HEAP32[$41>>2]|0;
  $43 = ((($42)) + -4|0);
  HEAP32[$41>>2] = $43;
  $9 = $43;
  $44 = $9;
  $6 = $40;
  $7 = $44;
  $45 = $6;
  $46 = $7;
  ;HEAP8[$5>>0]=HEAP8[$8>>0]|0;
  $3 = $45;
  $4 = $46;
  $47 = $3;
  $48 = $4;
  $1 = $47;
  $2 = $48;
 }
 $49 = $__old_size$i;
 __THREW__ = 0;
 invoke_vii(108,($21|0),($49|0));
 $50 = __THREW__; __THREW__ = 0;
 $51 = $50&1;
 if ($51) {
  $52 = ___cxa_find_matching_catch(0|0)|0;
  $53 = tempRet0;
  ___clang_call_terminate($52);
  // unreachable;
 } else {
  $0 = $21;
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvvEvPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $3 = $1;
 $4 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($3)|0);
 $5 = $$field2 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$field2 & 1;
 $8 = ($7|0)!=(0);
 if ($8) {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$field)|0);
  $11 = HEAP32[$10>>2]|0;
  $13 = $11;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 } else {
  $12 = $$field;
  $13 = $12;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 }
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvvEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1904|0);
}
function __ZN10emscripten8internal10getContextIM15CredictCardBaseFvvEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN15CredictCardBase20getDisCountForCommitEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($3|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN15CredictCardBase19commitCurrentAssignEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__annotator$i = 0, $__annotator$i2 = 0, $__old_size$i = 0;
 var $i = 0, $i1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 304|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 16|0;
 $13 = sp + 294|0;
 $__annotator$i2 = sp + 296|0;
 $34 = sp + 8|0;
 $39 = sp + 292|0;
 $__annotator$i = sp + 293|0;
 $57 = sp;
 $60 = sp + 295|0;
 $70 = $this;
 $71 = $70;
 $72 = ((($71)) + 36|0);
 $69 = $72;
 $73 = $69;
 $68 = $73;
 $74 = $68;
 $75 = ((($74)) + 4|0);
 $76 = HEAP32[$75>>2]|0;
 $77 = HEAP32[$74>>2]|0;
 $78 = $76;
 $79 = $77;
 $80 = (($78) - ($79))|0;
 $81 = (($80|0) / 4)&-1;
 $__old_size$i = $81;
 $67 = $73;
 $82 = $67;
 $83 = HEAP32[$82>>2]|0;
 $65 = $82;
 $66 = $83;
 $84 = $65;
 while(1) {
  $85 = $66;
  $86 = ((($84)) + 4|0);
  $87 = HEAP32[$86>>2]|0;
  $88 = ($85|0)!=($87|0);
  if (!($88)) {
   break;
  }
  $64 = $84;
  $89 = $64;
  $90 = ((($89)) + 8|0);
  $63 = $90;
  $91 = $63;
  $62 = $91;
  $92 = $62;
  $93 = ((($84)) + 4|0);
  $94 = HEAP32[$93>>2]|0;
  $95 = ((($94)) + -4|0);
  HEAP32[$93>>2] = $95;
  $61 = $95;
  $96 = $61;
  $58 = $92;
  $59 = $96;
  $97 = $58;
  $98 = $59;
  ;HEAP8[$57>>0]=HEAP8[$60>>0]|0;
  $55 = $97;
  $56 = $98;
  $99 = $55;
  $100 = $56;
  $53 = $99;
  $54 = $100;
 }
 $101 = $__old_size$i;
 __THREW__ = 0;
 invoke_vii(108,($73|0),($101|0));
 $102 = __THREW__; __THREW__ = 0;
 $103 = $102&1;
 if ($103) {
  $104 = ___cxa_find_matching_catch(0|0)|0;
  $105 = tempRet0;
  ___clang_call_terminate($104);
  // unreachable;
 }
 $52 = $73;
 $i = 0;
 while(1) {
  $106 = $i;
  $107 = ((($71)) + 12|0);
  $51 = $107;
  $108 = $51;
  $109 = ((($108)) + 4|0);
  $110 = HEAP32[$109>>2]|0;
  $111 = HEAP32[$108>>2]|0;
  $112 = $110;
  $113 = $111;
  $114 = (($112) - ($113))|0;
  $115 = (($114|0) / 4)&-1;
  $116 = ($106>>>0)<($115>>>0);
  if (!($116)) {
   break;
  }
  $117 = ((($71)) + 36|0);
  $118 = ((($71)) + 12|0);
  $119 = $i;
  $49 = $118;
  $50 = $119;
  $120 = $49;
  $121 = $50;
  $122 = HEAP32[$120>>2]|0;
  $123 = (($122) + ($121<<2)|0);
  $47 = $117;
  $48 = $123;
  $124 = $47;
  $125 = ((($124)) + 4|0);
  $126 = HEAP32[$125>>2]|0;
  $46 = $124;
  $127 = $46;
  $128 = ((($127)) + 8|0);
  $45 = $128;
  $129 = $45;
  $44 = $129;
  $130 = $44;
  $131 = HEAP32[$130>>2]|0;
  $132 = ($126|0)!=($131|0);
  if ($132) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$124,1);
   $43 = $124;
   $133 = $43;
   $134 = ((($133)) + 8|0);
   $42 = $134;
   $135 = $42;
   $41 = $135;
   $136 = $41;
   $137 = ((($124)) + 4|0);
   $138 = HEAP32[$137>>2]|0;
   $40 = $138;
   $139 = $40;
   $140 = $48;
   $36 = $136;
   $37 = $139;
   $38 = $140;
   $141 = $36;
   $142 = $37;
   $143 = $38;
   $35 = $143;
   $144 = $35;
   ;HEAP8[$34>>0]=HEAP8[$39>>0]|0;
   $31 = $141;
   $32 = $142;
   $33 = $144;
   $145 = $31;
   $146 = $32;
   $147 = $33;
   $30 = $147;
   $148 = $30;
   $27 = $145;
   $28 = $146;
   $29 = $148;
   $149 = $28;
   $150 = $29;
   $26 = $150;
   $151 = $26;
   $152 = HEAP32[$151>>2]|0;
   HEAP32[$149>>2] = $152;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
   $153 = ((($124)) + 4|0);
   $154 = HEAP32[$153>>2]|0;
   $155 = ((($154)) + 4|0);
   HEAP32[$153>>2] = $155;
  } else {
   $156 = $48;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($124,$156);
  }
  $157 = $i;
  $158 = (($157) + 1)|0;
  $i = $158;
 }
 $i1 = 0;
 while(1) {
  $159 = $i1;
  $160 = ((($71)) + 24|0);
  $25 = $160;
  $161 = $25;
  $162 = ((($161)) + 4|0);
  $163 = HEAP32[$162>>2]|0;
  $164 = HEAP32[$161>>2]|0;
  $165 = $163;
  $166 = $164;
  $167 = (($165) - ($166))|0;
  $168 = (($167|0) / 4)&-1;
  $169 = ($159>>>0)<($168>>>0);
  if (!($169)) {
   break;
  }
  $170 = ((($71)) + 36|0);
  $171 = ((($71)) + 24|0);
  $172 = $i1;
  $23 = $171;
  $24 = $172;
  $173 = $23;
  $174 = $24;
  $175 = HEAP32[$173>>2]|0;
  $176 = (($175) + ($174<<2)|0);
  $21 = $170;
  $22 = $176;
  $177 = $21;
  $178 = ((($177)) + 4|0);
  $179 = HEAP32[$178>>2]|0;
  $20 = $177;
  $180 = $20;
  $181 = ((($180)) + 8|0);
  $19 = $181;
  $182 = $19;
  $18 = $182;
  $183 = $18;
  $184 = HEAP32[$183>>2]|0;
  $185 = ($179|0)!=($184|0);
  if ($185) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i2,$177,1);
   $17 = $177;
   $186 = $17;
   $187 = ((($186)) + 8|0);
   $16 = $187;
   $188 = $16;
   $15 = $188;
   $189 = $15;
   $190 = ((($177)) + 4|0);
   $191 = HEAP32[$190>>2]|0;
   $14 = $191;
   $192 = $14;
   $193 = $22;
   $10 = $189;
   $11 = $192;
   $12 = $193;
   $194 = $10;
   $195 = $11;
   $196 = $12;
   $9 = $196;
   $197 = $9;
   ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
   $5 = $194;
   $6 = $195;
   $7 = $197;
   $198 = $5;
   $199 = $6;
   $200 = $7;
   $4 = $200;
   $201 = $4;
   $1 = $198;
   $2 = $199;
   $3 = $201;
   $202 = $2;
   $203 = $3;
   $0 = $203;
   $204 = $0;
   $205 = HEAP32[$204>>2]|0;
   HEAP32[$202>>2] = $205;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i2);
   $206 = ((($177)) + 4|0);
   $207 = HEAP32[$206>>2]|0;
   $208 = ((($207)) + 4|0);
   HEAP32[$206>>2] = $208;
  } else {
   $209 = $22;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($177,$209);
  }
  $210 = $i1;
  $211 = (($210) + 1)|0;
  $i1 = $211;
 }
 $212 = HEAP32[$71>>2]|0;
 $213 = ((($212)) + 8|0);
 $214 = HEAP32[$213>>2]|0;
 $215 = (FUNCTION_TABLE_ii[$214 & 255]($71)|0);
 $216 = ((($71)) + 8|0);
 HEAP32[$216>>2] = $215;
 STACKTOP = sp;return;
}
function __ZN15CredictCardBase14dumpBestAssignEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $18 = $this;
 $19 = $18;
 $20 = ((($19)) + 48|0);
 $17 = $20;
 $21 = $17;
 $16 = $21;
 $22 = $16;
 $15 = $22;
 $23 = $15;
 $14 = $23;
 $24 = $14;
 $13 = $24;
 $25 = $13;
 $12 = $25;
 $26 = $12;
 $27 = HEAP8[$26>>0]|0;
 $28 = $27&255;
 $29 = $28 & 1;
 $30 = ($29|0)!=(0);
 if ($30) {
  $6 = $23;
  $31 = $6;
  $5 = $31;
  $32 = $5;
  $4 = $32;
  $33 = $4;
  $34 = ((($33)) + 8|0);
  $35 = HEAP32[$34>>2]|0;
  $42 = $35;
 } else {
  $11 = $23;
  $36 = $11;
  $10 = $36;
  $37 = $10;
  $9 = $37;
  $38 = $9;
  $39 = ((($38)) + 1|0);
  $8 = $39;
  $40 = $8;
  $7 = $40;
  $41 = $7;
  $42 = $41;
 }
 $3 = $42;
 $43 = $3;
 HEAP32[$vararg_buffer>>2] = $43;
 (_printf((1856|0),($vararg_buffer|0))|0);
 $44 = (__ZN15CredictCardBase20getDisCountForCommitEv($19)|0);
 HEAP32[$vararg_buffer1>>2] = $44;
 (_printf((1880|0),($vararg_buffer1|0))|0);
 $i = 0;
 while(1) {
  $45 = $i;
  $46 = ((($19)) + 36|0);
  $2 = $46;
  $47 = $2;
  $48 = ((($47)) + 4|0);
  $49 = HEAP32[$48>>2]|0;
  $50 = HEAP32[$47>>2]|0;
  $51 = $49;
  $52 = $50;
  $53 = (($51) - ($52))|0;
  $54 = (($53|0) / 4)&-1;
  $55 = ($45>>>0)<($54>>>0);
  if (!($55)) {
   break;
  }
  $56 = ((($19)) + 36|0);
  $57 = $i;
  $0 = $56;
  $1 = $57;
  $58 = $0;
  $59 = $1;
  $60 = HEAP32[$58>>2]|0;
  $61 = (($60) + ($59<<2)|0);
  $62 = HEAP32[$61>>2]|0;
  __ZN4Bill4infoEv($62);
  $63 = $i;
  $64 = (($63) + 1)|0;
  $i = $64;
 }
 STACKTOP = sp;return;
}
function __ZN15CredictCardBase17getBestAssignBillERNSt3__16vectorIP4BillNS0_9allocatorIS3_EEEE($this,$billList) {
 $this = $this|0;
 $billList = $billList|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__annotator$i = 0, $__old_size$i = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 192|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp;
 $13 = sp + 190|0;
 $__annotator$i = sp + 188|0;
 $31 = sp + 8|0;
 $34 = sp + 189|0;
 $44 = $this;
 $45 = $billList;
 $46 = $44;
 $47 = $45;
 $43 = $47;
 $48 = $43;
 $42 = $48;
 $49 = $42;
 $50 = ((($49)) + 4|0);
 $51 = HEAP32[$50>>2]|0;
 $52 = HEAP32[$49>>2]|0;
 $53 = $51;
 $54 = $52;
 $55 = (($53) - ($54))|0;
 $56 = (($55|0) / 4)&-1;
 $__old_size$i = $56;
 $41 = $48;
 $57 = $41;
 $58 = HEAP32[$57>>2]|0;
 $39 = $57;
 $40 = $58;
 $59 = $39;
 while(1) {
  $60 = $40;
  $61 = ((($59)) + 4|0);
  $62 = HEAP32[$61>>2]|0;
  $63 = ($60|0)!=($62|0);
  if (!($63)) {
   break;
  }
  $38 = $59;
  $64 = $38;
  $65 = ((($64)) + 8|0);
  $37 = $65;
  $66 = $37;
  $36 = $66;
  $67 = $36;
  $68 = ((($59)) + 4|0);
  $69 = HEAP32[$68>>2]|0;
  $70 = ((($69)) + -4|0);
  HEAP32[$68>>2] = $70;
  $35 = $70;
  $71 = $35;
  $32 = $67;
  $33 = $71;
  $72 = $32;
  $73 = $33;
  ;HEAP8[$31>>0]=HEAP8[$34>>0]|0;
  $29 = $72;
  $30 = $73;
  $74 = $29;
  $75 = $30;
  $27 = $74;
  $28 = $75;
 }
 $76 = $__old_size$i;
 __THREW__ = 0;
 invoke_vii(108,($48|0),($76|0));
 $77 = __THREW__; __THREW__ = 0;
 $78 = $77&1;
 if ($78) {
  $79 = ___cxa_find_matching_catch(0|0)|0;
  $80 = tempRet0;
  ___clang_call_terminate($79);
  // unreachable;
 }
 $26 = $48;
 $i = 0;
 while(1) {
  $81 = $i;
  $82 = ((($46)) + 36|0);
  $25 = $82;
  $83 = $25;
  $84 = ((($83)) + 4|0);
  $85 = HEAP32[$84>>2]|0;
  $86 = HEAP32[$83>>2]|0;
  $87 = $85;
  $88 = $86;
  $89 = (($87) - ($88))|0;
  $90 = (($89|0) / 4)&-1;
  $91 = ($81>>>0)<($90>>>0);
  if (!($91)) {
   break;
  }
  $92 = $45;
  $93 = ((($46)) + 36|0);
  $94 = $i;
  $23 = $93;
  $24 = $94;
  $95 = $23;
  $96 = $24;
  $97 = HEAP32[$95>>2]|0;
  $98 = (($97) + ($96<<2)|0);
  $21 = $92;
  $22 = $98;
  $99 = $21;
  $100 = ((($99)) + 4|0);
  $101 = HEAP32[$100>>2]|0;
  $20 = $99;
  $102 = $20;
  $103 = ((($102)) + 8|0);
  $19 = $103;
  $104 = $19;
  $18 = $104;
  $105 = $18;
  $106 = HEAP32[$105>>2]|0;
  $107 = ($101|0)!=($106|0);
  if ($107) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$99,1);
   $17 = $99;
   $108 = $17;
   $109 = ((($108)) + 8|0);
   $16 = $109;
   $110 = $16;
   $15 = $110;
   $111 = $15;
   $112 = ((($99)) + 4|0);
   $113 = HEAP32[$112>>2]|0;
   $14 = $113;
   $114 = $14;
   $115 = $22;
   $10 = $111;
   $11 = $114;
   $12 = $115;
   $116 = $10;
   $117 = $11;
   $118 = $12;
   $9 = $118;
   $119 = $9;
   ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
   $5 = $116;
   $6 = $117;
   $7 = $119;
   $120 = $5;
   $121 = $6;
   $122 = $7;
   $4 = $122;
   $123 = $4;
   $1 = $120;
   $2 = $121;
   $3 = $123;
   $124 = $2;
   $125 = $3;
   $0 = $125;
   $126 = $0;
   $127 = HEAP32[$126>>2]|0;
   HEAP32[$124>>2] = $127;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
   $128 = ((($99)) + 4|0);
   $129 = HEAP32[$128>>2]|0;
   $130 = ((($129)) + 4|0);
   HEAP32[$128>>2] = $130;
  } else {
   $131 = $22;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($99,$131);
  }
  $132 = $i;
  $133 = (($132) + 1)|0;
  $i = $133;
 }
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEvPS2_JSA_EE6invokeERKSC_SD_PS9_($method,$wireThis,$args) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $16 = $12;
 } else {
  $13 = $$field;
  $16 = $13;
 }
 $14 = $2;
 $15 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeEPS8_($14)|0);
 FUNCTION_TABLE_vii[$16 & 255]($7,$15);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS7_9allocatorISA_EEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS7_9allocatorISA_EEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS6_9allocatorIS9_EEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEPS2_PS9_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1632|0);
}
function __ZN10emscripten8internal10getContextIM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEEPT_RKSD_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE6verifyI13CredictCardHNEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI13CredictCardHNEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI13CredictCardHNEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI13CredictCardHNEEPFPS1_PT_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (112|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI13CredictCardHNEEPFPT_PS1_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (113|0);
}
function __ZN10emscripten8internal14raw_destructorI13CredictCardHNEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  STACKTOP = sp;return;
 }
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 FUNCTION_TABLE_vi[$5 & 255]($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI13CredictCardHNE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI13CredictCardHNE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13CredictCardHNEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP13CredictCardHNE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13CredictCardHNEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK13CredictCardHNE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDI15CredictCardBaseE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP13CredictCardHNEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1584|0);
}
function __ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP13CredictCardHNEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1576|0);
}
function __ZN10emscripten8internal12getSignatureIP13CredictCardHNJP15CredictCardBaseEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1568|0);
}
function __ZN10emscripten8internal12getSignatureIvJP13CredictCardHNEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1560|0);
}
function __ZN10emscripten8internal12operator_newI13CredictCardHNJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_($args) {
 $args = $args|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0;
 var $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 8|0;
 $11 = sp + 60|0;
 $7 = $args;
 $12 = (__Znwj(60)|0);
 $$expand_i1_val = 1;
 HEAP8[$11>>0] = $$expand_i1_val;
 $13 = $7;
 $6 = $13;
 $14 = $6;
 $4 = $8;
 $5 = $14;
 $15 = $4;
 $16 = $5;
 $3 = $16;
 $17 = $3;
 ;HEAP32[$15>>2]=HEAP32[$17>>2]|0;HEAP32[$15+4>>2]=HEAP32[$17+4>>2]|0;HEAP32[$15+8>>2]=HEAP32[$17+8>>2]|0;
 $18 = $5;
 $2 = $18;
 $19 = $2;
 $1 = $19;
 $20 = $1;
 $0 = $20;
 $21 = $0;
 $__a$i$i = $21;
 $__i$i$i = 0;
 while(1) {
  $22 = $__i$i$i;
  $23 = ($22>>>0)<(3);
  if (!($23)) {
   break;
  }
  $24 = $__i$i$i;
  $25 = $__a$i$i;
  $26 = (($25) + ($24<<2)|0);
  HEAP32[$26>>2] = 0;
  $27 = $__i$i$i;
  $28 = (($27) + 1)|0;
  $__i$i$i = $28;
 }
 __THREW__ = 0;
 invoke_vii(114,($12|0),($8|0));
 $29 = __THREW__; __THREW__ = 0;
 $30 = $29&1;
 if (!($30)) {
  $$expand_i1_val2 = 0;
  HEAP8[$11>>0] = $$expand_i1_val2;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
  STACKTOP = sp;return ($12|0);
 }
 $31 = ___cxa_find_matching_catch()|0;
 $32 = tempRet0;
 $9 = $31;
 $10 = $32;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
 $$pre_trunc = HEAP8[$11>>0]|0;
 $33 = $$pre_trunc&1;
 if (!($33)) {
  $34 = $9;
  $35 = $10;
  ___resumeException($34|0);
  // unreachable;
 }
 __ZdlPv($12);
 $34 = $9;
 $35 = $10;
 ___resumeException($34|0);
 // unreachable;
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP13CredictCardHNJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E($fn,$args) {
 $fn = $fn|0;
 $args = $args|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $fn;
 $1 = $args;
 $5 = $0;
 $6 = $1;
 __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($2,$6);
 __THREW__ = 0;
 $7 = (invoke_ii($5|0,($2|0))|0);
 $8 = __THREW__; __THREW__ = 0;
 $9 = $8&1;
 if (!($9)) {
  __THREW__ = 0;
  $10 = (invoke_ii(115,($7|0))|0);
  $11 = __THREW__; __THREW__ = 0;
  $12 = $11&1;
  if (!($12)) {
   __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
   STACKTOP = sp;return ($10|0);
  }
 }
 $13 = ___cxa_find_matching_catch()|0;
 $14 = tempRet0;
 $3 = $13;
 $4 = $14;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
 $15 = $3;
 $16 = $4;
 ___resumeException($15|0);
 // unreachable;
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardHNONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardHNONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13CredictCardHNEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP13CredictCardHNJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1544|0);
}
function __ZN10emscripten8internal13MethodInvokerIM13CredictCardHNFivEiPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP13CredictCardHNE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIiJRKM13CredictCardHNFivEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1488|0);
}
function __ZN10emscripten8internal10getContextIM13CredictCardHNFivEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE6verifyI13CredictCardYSEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI13CredictCardYSEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI13CredictCardYSEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI13CredictCardYSEEPFPS1_PT_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (116|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI13CredictCardYSEEPFPT_PS1_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (117|0);
}
function __ZN10emscripten8internal14raw_destructorI13CredictCardYSEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  STACKTOP = sp;return;
 }
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 FUNCTION_TABLE_vi[$5 & 255]($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI13CredictCardYSE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI13CredictCardYSE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13CredictCardYSEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP13CredictCardYSE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13CredictCardYSEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK13CredictCardYSE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP13CredictCardYSEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1440|0);
}
function __ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP13CredictCardYSEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1432|0);
}
function __ZN10emscripten8internal12getSignatureIP13CredictCardYSJP15CredictCardBaseEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1424|0);
}
function __ZN10emscripten8internal12getSignatureIvJP13CredictCardYSEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1416|0);
}
function __ZN10emscripten8internal12operator_newI13CredictCardYSJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_($args) {
 $args = $args|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0;
 var $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 8|0;
 $11 = sp + 60|0;
 $7 = $args;
 $12 = (__Znwj(60)|0);
 $$expand_i1_val = 1;
 HEAP8[$11>>0] = $$expand_i1_val;
 $13 = $7;
 $6 = $13;
 $14 = $6;
 $4 = $8;
 $5 = $14;
 $15 = $4;
 $16 = $5;
 $3 = $16;
 $17 = $3;
 ;HEAP32[$15>>2]=HEAP32[$17>>2]|0;HEAP32[$15+4>>2]=HEAP32[$17+4>>2]|0;HEAP32[$15+8>>2]=HEAP32[$17+8>>2]|0;
 $18 = $5;
 $2 = $18;
 $19 = $2;
 $1 = $19;
 $20 = $1;
 $0 = $20;
 $21 = $0;
 $__a$i$i = $21;
 $__i$i$i = 0;
 while(1) {
  $22 = $__i$i$i;
  $23 = ($22>>>0)<(3);
  if (!($23)) {
   break;
  }
  $24 = $__i$i$i;
  $25 = $__a$i$i;
  $26 = (($25) + ($24<<2)|0);
  HEAP32[$26>>2] = 0;
  $27 = $__i$i$i;
  $28 = (($27) + 1)|0;
  $__i$i$i = $28;
 }
 __THREW__ = 0;
 invoke_vii(118,($12|0),($8|0));
 $29 = __THREW__; __THREW__ = 0;
 $30 = $29&1;
 if (!($30)) {
  $$expand_i1_val2 = 0;
  HEAP8[$11>>0] = $$expand_i1_val2;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
  STACKTOP = sp;return ($12|0);
 }
 $31 = ___cxa_find_matching_catch()|0;
 $32 = tempRet0;
 $9 = $31;
 $10 = $32;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
 $$pre_trunc = HEAP8[$11>>0]|0;
 $33 = $$pre_trunc&1;
 if (!($33)) {
  $34 = $9;
  $35 = $10;
  ___resumeException($34|0);
  // unreachable;
 }
 __ZdlPv($12);
 $34 = $9;
 $35 = $10;
 ___resumeException($34|0);
 // unreachable;
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP13CredictCardYSJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E($fn,$args) {
 $fn = $fn|0;
 $args = $args|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $fn;
 $1 = $args;
 $5 = $0;
 $6 = $1;
 __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($2,$6);
 __THREW__ = 0;
 $7 = (invoke_ii($5|0,($2|0))|0);
 $8 = __THREW__; __THREW__ = 0;
 $9 = $8&1;
 if (!($9)) {
  __THREW__ = 0;
  $10 = (invoke_ii(119,($7|0))|0);
  $11 = __THREW__; __THREW__ = 0;
  $12 = $11&1;
  if (!($12)) {
   __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
   STACKTOP = sp;return ($10|0);
  }
 }
 $13 = ___cxa_find_matching_catch()|0;
 $14 = tempRet0;
 $3 = $13;
 $4 = $14;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
 $15 = $3;
 $16 = $4;
 ___resumeException($15|0);
 // unreachable;
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardYSONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13CredictCardYSONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13CredictCardYSEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP13CredictCardYSJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1400|0);
}
function __ZN10emscripten8internal13MethodInvokerIM13CredictCardYSFivEiPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP13CredictCardYSE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIiJRKM13CredictCardYSFivEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1344|0);
}
function __ZN10emscripten8internal10getContextIM13CredictCardYSFivEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE6verifyI18CredictCardHNICashEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI18CredictCardHNICashEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI18CredictCardHNICashEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE11getUpcasterI18CredictCardHNICashEEPFPS1_PT_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (120|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE13getDowncasterI18CredictCardHNICashEEPFPT_PS1_Ev() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (121|0);
}
function __ZN10emscripten8internal14raw_destructorI18CredictCardHNICashEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  STACKTOP = sp;return;
 }
 $3 = HEAP32[$1>>2]|0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 FUNCTION_TABLE_vi[$5 & 255]($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI18CredictCardHNICashE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI18CredictCardHNICashE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI18CredictCardHNICashEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP18CredictCardHNICashE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK18CredictCardHNICashEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK18CredictCardHNICashE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP18CredictCardHNICashEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1296|0);
}
function __ZN10emscripten8internal12getSignatureIP15CredictCardBaseJP18CredictCardHNICashEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1288|0);
}
function __ZN10emscripten8internal12getSignatureIP18CredictCardHNICashJP15CredictCardBaseEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1280|0);
}
function __ZN10emscripten8internal12getSignatureIvJP18CredictCardHNICashEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1272|0);
}
function __ZN10emscripten8internal12operator_newI18CredictCardHNICashJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_($args) {
 $args = $args|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$pre_trunc = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0;
 var $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 8|0;
 $11 = sp + 60|0;
 $7 = $args;
 $12 = (__Znwj(60)|0);
 $$expand_i1_val = 1;
 HEAP8[$11>>0] = $$expand_i1_val;
 $13 = $7;
 $6 = $13;
 $14 = $6;
 $4 = $8;
 $5 = $14;
 $15 = $4;
 $16 = $5;
 $3 = $16;
 $17 = $3;
 ;HEAP32[$15>>2]=HEAP32[$17>>2]|0;HEAP32[$15+4>>2]=HEAP32[$17+4>>2]|0;HEAP32[$15+8>>2]=HEAP32[$17+8>>2]|0;
 $18 = $5;
 $2 = $18;
 $19 = $2;
 $1 = $19;
 $20 = $1;
 $0 = $20;
 $21 = $0;
 $__a$i$i = $21;
 $__i$i$i = 0;
 while(1) {
  $22 = $__i$i$i;
  $23 = ($22>>>0)<(3);
  if (!($23)) {
   break;
  }
  $24 = $__i$i$i;
  $25 = $__a$i$i;
  $26 = (($25) + ($24<<2)|0);
  HEAP32[$26>>2] = 0;
  $27 = $__i$i$i;
  $28 = (($27) + 1)|0;
  $__i$i$i = $28;
 }
 __THREW__ = 0;
 invoke_vii(122,($12|0),($8|0));
 $29 = __THREW__; __THREW__ = 0;
 $30 = $29&1;
 if (!($30)) {
  $$expand_i1_val2 = 0;
  HEAP8[$11>>0] = $$expand_i1_val2;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
  STACKTOP = sp;return ($12|0);
 }
 $31 = ___cxa_find_matching_catch()|0;
 $32 = tempRet0;
 $9 = $31;
 $10 = $32;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($8);
 $$pre_trunc = HEAP8[$11>>0]|0;
 $33 = $$pre_trunc&1;
 if (!($33)) {
  $34 = $9;
  $35 = $10;
  ___resumeException($34|0);
  // unreachable;
 }
 __ZdlPv($12);
 $34 = $9;
 $35 = $10;
 ___resumeException($34|0);
 // unreachable;
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP18CredictCardHNICashJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E($fn,$args) {
 $fn = $fn|0;
 $args = $args|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $fn;
 $1 = $args;
 $5 = $0;
 $6 = $1;
 __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($2,$6);
 __THREW__ = 0;
 $7 = (invoke_ii($5|0,($2|0))|0);
 $8 = __THREW__; __THREW__ = 0;
 $9 = $8&1;
 if (!($9)) {
  __THREW__ = 0;
  $10 = (invoke_ii(123,($7|0))|0);
  $11 = __THREW__; __THREW__ = 0;
  $12 = $11&1;
  if (!($12)) {
   __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
   STACKTOP = sp;return ($10|0);
  }
 }
 $13 = ___cxa_find_matching_catch()|0;
 $14 = tempRet0;
 $3 = $13;
 $4 = $14;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
 $15 = $3;
 $16 = $4;
 ___resumeException($15|0);
 // unreachable;
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP18CredictCardHNICashONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP18CredictCardHNICashONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI18CredictCardHNICashEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP18CredictCardHNICashJPFS3_ONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEPNS0_11BindingTypeISA_EUt_EEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1080|0);
}
function __ZN10emscripten8internal11NoBaseClass6verifyI14CredictCardMgrEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI14CredictCardMgrEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDI14CredictCardMgrEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI14CredictCardMgrEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI14CredictCardMgrEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorI14CredictCardMgrEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  __ZN14CredictCardMgrD2Ev($1);
  __ZdlPv($1);
 }
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDI14CredictCardMgrE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI14CredictCardMgrE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI14CredictCardMgrEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP14CredictCardMgrE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK14CredictCardMgrEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK14CredictCardMgrE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJP14CredictCardMgrEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1032|0);
}
function __ZN10emscripten8internal12getSignatureIvJP14CredictCardMgrEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1024|0);
}
function __ZN10emscripten8internal12operator_newI14CredictCardMgrJEEEPT_DpOT0_() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = (__Znwj(28)|0);
 __THREW__ = 0;
 invoke_vi(124,($2|0));
 $3 = __THREW__; __THREW__ = 0;
 $4 = $3&1;
 if ($4) {
  $5 = ___cxa_find_matching_catch()|0;
  $6 = tempRet0;
  $0 = $5;
  $1 = $6;
  __ZdlPv($2);
  $7 = $0;
  $8 = $1;
  ___resumeException($7|0);
  // unreachable;
 } else {
  STACKTOP = sp;return ($2|0);
 }
 return (0)|0;
}
function __ZN10emscripten8internal7InvokerIP14CredictCardMgrJEE6invokeEPFS3_vE($fn) {
 $fn = $fn|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $fn;
 $1 = $0;
 $2 = (FUNCTION_TABLE_i[$1 & 255]()|0);
 $3 = (__ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE10toWireTypeES3_($2)|0);
 STACKTOP = sp;return ($3|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP14CredictCardMgrEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 1;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP14CredictCardMgrEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIP14CredictCardMgrJPFS3_vEEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (1008|0);
}
function __ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvP4BillP15CredictCardBaseEvPS2_JS4_S6_EE6invokeERKS8_S9_S4_S6_($method,$wireThis,$args,$args1) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 $args1 = $args1|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $3 = $args1;
 $4 = $0;
 $$field = HEAP32[$4>>2]|0;
 $$index1 = ((($4)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $5 = $1;
 $6 = (__ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE12fromWireTypeES3_($5)|0);
 $7 = $$field2 >> 1;
 $8 = (($6) + ($7)|0);
 $9 = $$field2 & 1;
 $10 = ($9|0)!=(0);
 if ($10) {
  $11 = HEAP32[$8>>2]|0;
  $12 = (($11) + ($$field)|0);
  $13 = HEAP32[$12>>2]|0;
  $19 = $13;
 } else {
  $14 = $$field;
  $19 = $14;
 }
 $15 = $2;
 $16 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($15)|0);
 $17 = $3;
 $18 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($17)|0);
 FUNCTION_TABLE_viii[$19 & 255]($8,$16,$18);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP4BillP15CredictCardBaseEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP4BillP15CredictCardBaseEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEENS3_I4BillEENS3_I15CredictCardBaseEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvP4BillP15CredictCardBaseEPS2_S4_S6_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (944|0);
}
function __ZN10emscripten8internal10getContextIM14CredictCardMgrFvP4BillP15CredictCardBaseEEEPT_RKS9_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvP15CredictCardBaseEvPS2_JS4_EE6invokeERKS6_S7_S4_($method,$wireThis,$args) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $16 = $12;
 } else {
  $13 = $$field;
  $16 = $13;
 }
 $14 = $2;
 $15 = (__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($14)|0);
 FUNCTION_TABLE_vii[$16 & 255]($7,$15);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP15CredictCardBaseEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEP15CredictCardBaseEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEENS3_I15CredictCardBaseEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvP15CredictCardBaseEPS2_S4_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (880|0);
}
function __ZN10emscripten8internal10getContextIM14CredictCardMgrFvP15CredictCardBaseEEEPT_RKS7_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvvEvPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $method;
 $1 = $wireThis;
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $3 = $1;
 $4 = (__ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE12fromWireTypeES3_($3)|0);
 $5 = $$field2 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$field2 & 1;
 $8 = ($7|0)!=(0);
 if ($8) {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$field)|0);
  $11 = HEAP32[$10>>2]|0;
  $13 = $11;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 } else {
  $12 = $$field;
  $13 = $12;
  FUNCTION_TABLE_vi[$13 & 255]($6);
  STACKTOP = sp;return;
 }
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKM14CredictCardMgrFvvEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (864|0);
}
function __ZN10emscripten8internal10getContextIM14CredictCardMgrFvvEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN14CredictCardMgr14getMaxDisCountEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 24|0);
 $3 = HEAP32[$2>>2]|0;
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFivEiPS2_JEE6invokeERKS4_S5_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE12fromWireTypeES3_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIiJRKM14CredictCardMgrFivEPS2_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (776|0);
}
function __ZN10emscripten8internal10getContextIM14CredictCardMgrFivEEEPT_RKS5_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($this,$0,$__n) {
 $this = $this|0;
 $0 = $0|0;
 $__n = $__n|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $this;
 $2 = $0;
 $3 = $__n;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($this,$__x) {
 $this = $this|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__a = 0, $__cap$i = 0, $__ms$i = 0, $__v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 8|0;
 $13 = sp + 201|0;
 $22 = sp;
 $25 = sp + 200|0;
 $33 = sp + 12|0;
 $34 = sp + 60|0;
 $__v = sp + 92|0;
 $39 = $this;
 $40 = $__x;
 $43 = $39;
 $38 = $43;
 $44 = $38;
 $45 = ((($44)) + 8|0);
 $37 = $45;
 $46 = $37;
 $36 = $46;
 $47 = $36;
 $__a = $47;
 $35 = $43;
 $48 = $35;
 $49 = ((($48)) + 4|0);
 $50 = HEAP32[$49>>2]|0;
 $51 = HEAP32[$48>>2]|0;
 $52 = $50;
 $53 = $51;
 $54 = (($52) - ($53))|0;
 $55 = (($54|0) / 4)&-1;
 $56 = (($55) + 1)|0;
 $32 = $43;
 HEAP32[$33>>2] = $56;
 $57 = $32;
 $58 = (__ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE8max_sizeEv($57)|0);
 $__ms$i = $58;
 $59 = HEAP32[$33>>2]|0;
 $60 = $__ms$i;
 $61 = ($59>>>0)>($60>>>0);
 if ($61) {
  __ZNKSt3__120__vector_base_commonILb1EE20__throw_length_errorEv($57);
  // unreachable;
 }
 $30 = $57;
 $62 = $30;
 $29 = $62;
 $63 = $29;
 $28 = $63;
 $64 = $28;
 $65 = ((($64)) + 8|0);
 $27 = $65;
 $66 = $27;
 $26 = $66;
 $67 = $26;
 $68 = HEAP32[$67>>2]|0;
 $69 = HEAP32[$63>>2]|0;
 $70 = $68;
 $71 = $69;
 $72 = (($70) - ($71))|0;
 $73 = (($72|0) / 4)&-1;
 $__cap$i = $73;
 $74 = $__cap$i;
 $75 = $__ms$i;
 $76 = (($75>>>0) / 2)&-1;
 $77 = ($74>>>0)>=($76>>>0);
 if ($77) {
  $78 = $__ms$i;
  $31 = $78;
 } else {
  $79 = $__cap$i;
  $80 = $79<<1;
  HEAP32[$34>>2] = $80;
  $23 = $34;
  $24 = $33;
  $81 = $23;
  $82 = $24;
  ;HEAP8[$22>>0]=HEAP8[$25>>0]|0;
  $20 = $81;
  $21 = $82;
  $83 = $20;
  $84 = $21;
  $17 = $22;
  $18 = $83;
  $19 = $84;
  $85 = $18;
  $86 = HEAP32[$85>>2]|0;
  $87 = $19;
  $88 = HEAP32[$87>>2]|0;
  $89 = ($86>>>0)<($88>>>0);
  $90 = $21;
  $91 = $20;
  $92 = $89 ? $90 : $91;
  $93 = HEAP32[$92>>2]|0;
  $31 = $93;
 }
 $94 = $31;
 $16 = $43;
 $95 = $16;
 $96 = ((($95)) + 4|0);
 $97 = HEAP32[$96>>2]|0;
 $98 = HEAP32[$95>>2]|0;
 $99 = $97;
 $100 = $98;
 $101 = (($99) - ($100))|0;
 $102 = (($101|0) / 4)&-1;
 $103 = $__a;
 __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEEC2EjjS5_($__v,$94,$102,$103);
 $104 = $__a;
 $105 = ((($__v)) + 8|0);
 $106 = HEAP32[$105>>2]|0;
 $15 = $106;
 $107 = $15;
 $108 = $40;
 $14 = $108;
 $109 = $14;
 $10 = $104;
 $11 = $107;
 $12 = $109;
 $110 = $10;
 $111 = $11;
 $112 = $12;
 $9 = $112;
 $113 = $9;
 ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
 $5 = $110;
 $6 = $111;
 $7 = $113;
 $114 = $5;
 $115 = $6;
 $116 = $7;
 $4 = $116;
 $117 = $4;
 $1 = $114;
 $2 = $115;
 $3 = $117;
 $118 = $2;
 $119 = $3;
 $0 = $119;
 $120 = $0;
 $121 = HEAP32[$120>>2]|0;
 HEAP32[$118>>2] = $121;
 $122 = ((($__v)) + 8|0);
 $123 = HEAP32[$122>>2]|0;
 $124 = ((($123)) + 4|0);
 HEAP32[$122>>2] = $124;
 __THREW__ = 0;
 invoke_vii(125,($43|0),($__v|0));
 $125 = __THREW__; __THREW__ = 0;
 $126 = $125&1;
 if ($126) {
  $127 = ___cxa_find_matching_catch()|0;
  $128 = tempRet0;
  $41 = $127;
  $42 = $128;
  __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($__v);
  $129 = $41;
  $130 = $42;
  ___resumeException($129|0);
  // unreachable;
 } else {
  __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($__v);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($this,$0,$__n) {
 $this = $this|0;
 $0 = $0|0;
 $__n = $__n|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $this;
 $2 = $0;
 $3 = $__n;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($this,$__x) {
 $this = $this|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0;
 var $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__a = 0, $__cap$i = 0, $__ms$i = 0, $__v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp + 8|0;
 $13 = sp + 201|0;
 $22 = sp;
 $25 = sp + 200|0;
 $33 = sp + 12|0;
 $34 = sp + 60|0;
 $__v = sp + 92|0;
 $39 = $this;
 $40 = $__x;
 $43 = $39;
 $38 = $43;
 $44 = $38;
 $45 = ((($44)) + 8|0);
 $37 = $45;
 $46 = $37;
 $36 = $46;
 $47 = $36;
 $__a = $47;
 $35 = $43;
 $48 = $35;
 $49 = ((($48)) + 4|0);
 $50 = HEAP32[$49>>2]|0;
 $51 = HEAP32[$48>>2]|0;
 $52 = $50;
 $53 = $51;
 $54 = (($52) - ($53))|0;
 $55 = (($54|0) / 4)&-1;
 $56 = (($55) + 1)|0;
 $32 = $43;
 HEAP32[$33>>2] = $56;
 $57 = $32;
 $58 = (__ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE8max_sizeEv($57)|0);
 $__ms$i = $58;
 $59 = HEAP32[$33>>2]|0;
 $60 = $__ms$i;
 $61 = ($59>>>0)>($60>>>0);
 if ($61) {
  __ZNKSt3__120__vector_base_commonILb1EE20__throw_length_errorEv($57);
  // unreachable;
 }
 $30 = $57;
 $62 = $30;
 $29 = $62;
 $63 = $29;
 $28 = $63;
 $64 = $28;
 $65 = ((($64)) + 8|0);
 $27 = $65;
 $66 = $27;
 $26 = $66;
 $67 = $26;
 $68 = HEAP32[$67>>2]|0;
 $69 = HEAP32[$63>>2]|0;
 $70 = $68;
 $71 = $69;
 $72 = (($70) - ($71))|0;
 $73 = (($72|0) / 4)&-1;
 $__cap$i = $73;
 $74 = $__cap$i;
 $75 = $__ms$i;
 $76 = (($75>>>0) / 2)&-1;
 $77 = ($74>>>0)>=($76>>>0);
 if ($77) {
  $78 = $__ms$i;
  $31 = $78;
 } else {
  $79 = $__cap$i;
  $80 = $79<<1;
  HEAP32[$34>>2] = $80;
  $23 = $34;
  $24 = $33;
  $81 = $23;
  $82 = $24;
  ;HEAP8[$22>>0]=HEAP8[$25>>0]|0;
  $20 = $81;
  $21 = $82;
  $83 = $20;
  $84 = $21;
  $17 = $22;
  $18 = $83;
  $19 = $84;
  $85 = $18;
  $86 = HEAP32[$85>>2]|0;
  $87 = $19;
  $88 = HEAP32[$87>>2]|0;
  $89 = ($86>>>0)<($88>>>0);
  $90 = $21;
  $91 = $20;
  $92 = $89 ? $90 : $91;
  $93 = HEAP32[$92>>2]|0;
  $31 = $93;
 }
 $94 = $31;
 $16 = $43;
 $95 = $16;
 $96 = ((($95)) + 4|0);
 $97 = HEAP32[$96>>2]|0;
 $98 = HEAP32[$95>>2]|0;
 $99 = $97;
 $100 = $98;
 $101 = (($99) - ($100))|0;
 $102 = (($101|0) / 4)&-1;
 $103 = $__a;
 __ZNSt3__114__split_bufferIP15CredictCardBaseRNS_9allocatorIS2_EEEC2EjjS5_($__v,$94,$102,$103);
 $104 = $__a;
 $105 = ((($__v)) + 8|0);
 $106 = HEAP32[$105>>2]|0;
 $15 = $106;
 $107 = $15;
 $108 = $40;
 $14 = $108;
 $109 = $14;
 $10 = $104;
 $11 = $107;
 $12 = $109;
 $110 = $10;
 $111 = $11;
 $112 = $12;
 $9 = $112;
 $113 = $9;
 ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
 $5 = $110;
 $6 = $111;
 $7 = $113;
 $114 = $5;
 $115 = $6;
 $116 = $7;
 $4 = $116;
 $117 = $4;
 $1 = $114;
 $2 = $115;
 $3 = $117;
 $118 = $2;
 $119 = $3;
 $0 = $119;
 $120 = $0;
 $121 = HEAP32[$120>>2]|0;
 HEAP32[$118>>2] = $121;
 $122 = ((($__v)) + 8|0);
 $123 = HEAP32[$122>>2]|0;
 $124 = ((($123)) + 4|0);
 HEAP32[$122>>2] = $124;
 __THREW__ = 0;
 invoke_vii(126,($43|0),($__v|0));
 $125 = __THREW__; __THREW__ = 0;
 $126 = $125&1;
 if ($126) {
  $127 = ___cxa_find_matching_catch()|0;
  $128 = tempRet0;
  $41 = $127;
  $42 = $128;
  __ZNSt3__114__split_bufferIP15CredictCardBaseRNS_9allocatorIS2_EEED2Ev($__v);
  $129 = $41;
  $130 = $42;
  ___resumeException($129|0);
  // unreachable;
 } else {
  __ZNSt3__114__split_bufferIP15CredictCardBaseRNS_9allocatorIS2_EEED2Ev($__v);
  STACKTOP = sp;return;
 }
}
function __ZN13CredictCardHND2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN15CredictCardBaseD2Ev($1);
 STACKTOP = sp;return;
}
function __ZN13CredictCardHND0Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN13CredictCardHND2Ev($1);
 __ZdlPv($1);
 STACKTOP = sp;return;
}
function __ZN13CredictCardYSD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN15CredictCardBaseD2Ev($1);
 STACKTOP = sp;return;
}
function __ZN13CredictCardYSD0Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN13CredictCardYSD2Ev($1);
 __ZdlPv($1);
 STACKTOP = sp;return;
}
function __ZN18CredictCardHNICashD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN15CredictCardBaseD2Ev($1);
 STACKTOP = sp;return;
}
function __ZN18CredictCardHNICashD0Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN18CredictCardHNICashD2Ev($1);
 __ZdlPv($1);
 STACKTOP = sp;return;
}
function __GLOBAL__sub_I_embind_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init();
 ___cxx_global_var_init5();
 ___cxx_global_var_init11();
 ___cxx_global_var_init25();
 return;
}
function ___cxx_global_var_init() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN37EmscriptenBindingInitializer_BillTypeC2Ev(720);
 return;
}
function ___cxx_global_var_init5() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN33EmscriptenBindingInitializer_BillC2Ev(712);
 return;
}
function ___cxx_global_var_init11() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN44EmscriptenBindingInitializer_CredictCardBaseC2Ev(704);
 return;
}
function ___cxx_global_var_init25() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN43EmscriptenBindingInitializer_CredictCardMgrC2Ev(696);
 return;
}
function __ZN15CredictCardBaseD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = 736;
 HEAP32[$1>>2] = $2;
 $3 = ((($1)) + 48|0);
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($3);
 $4 = ((($1)) + 36|0);
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($4);
 $5 = ((($1)) + 24|0);
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($5);
 $6 = ((($1)) + 12|0);
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($6);
 STACKTOP = sp;return;
}
function __ZN15CredictCardBaseD0Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZN15CredictCardBaseD2Ev($1);
 __ZdlPv($1);
 STACKTOP = sp;return;
}
function __ZN15CredictCardBase11getDisCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 0;
}
function __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE8max_sizeEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $8 = sp + 76|0;
 $11 = sp + 8|0;
 $13 = sp + 77|0;
 $18 = sp + 32|0;
 $19 = sp + 36|0;
 $17 = $this;
 $20 = $17;
 $16 = $20;
 $21 = $16;
 $22 = ((($21)) + 8|0);
 $15 = $22;
 $23 = $15;
 $14 = $23;
 $24 = $14;
 $12 = $24;
 $25 = $12;
 ;HEAP8[$11>>0]=HEAP8[$13>>0]|0;
 $10 = $25;
 $26 = $10;
 $9 = $26;
 HEAP32[$18>>2] = 1073741823;
 $27 = (4294967295 / 2)&-1;
 HEAP32[$19>>2] = $27;
 $6 = $18;
 $7 = $19;
 $28 = $6;
 $29 = $7;
 ;HEAP8[$5>>0]=HEAP8[$8>>0]|0;
 $3 = $28;
 $4 = $29;
 $30 = $4;
 $31 = $3;
 $0 = $5;
 $1 = $30;
 $2 = $31;
 $32 = $1;
 $33 = HEAP32[$32>>2]|0;
 $34 = $2;
 $35 = HEAP32[$34>>2]|0;
 $36 = ($33>>>0)<($35>>>0);
 $37 = $4;
 $38 = $3;
 $39 = $36 ? $37 : $38;
 $40 = HEAP32[$39>>2]|0;
 STACKTOP = sp;return ($40|0);
}
function __ZNSt3__114__split_bufferIP15CredictCardBaseRNS_9allocatorIS2_EEEC2EjjS5_($this,$__cap,$__start,$__a) {
 $this = $this|0;
 $__cap = $__cap|0;
 $__start = $__start|0;
 $__a = $__a|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $16 = sp + 4|0;
 $20 = sp + 24|0;
 $22 = $this;
 $23 = $__cap;
 $24 = $__start;
 $25 = $__a;
 $26 = $22;
 $27 = ((($26)) + 12|0);
 $28 = $25;
 $19 = $27;
 HEAP32[$20>>2] = 0;
 $21 = $28;
 $29 = $19;
 $18 = $20;
 $30 = $18;
 $31 = HEAP32[$30>>2]|0;
 $32 = $21;
 $12 = $32;
 $33 = $12;
 $15 = $29;
 HEAP32[$16>>2] = $31;
 $17 = $33;
 $34 = $15;
 $14 = $16;
 $35 = $14;
 $36 = HEAP32[$35>>2]|0;
 HEAP32[$34>>2] = $36;
 $37 = ((($34)) + 4|0);
 $38 = $17;
 $13 = $38;
 $39 = $13;
 HEAP32[$37>>2] = $39;
 $40 = $23;
 $41 = ($40|0)!=(0);
 if ($41) {
  $2 = $26;
  $42 = $2;
  $43 = ((($42)) + 12|0);
  $1 = $43;
  $44 = $1;
  $0 = $44;
  $45 = $0;
  $46 = ((($45)) + 4|0);
  $47 = HEAP32[$46>>2]|0;
  $48 = $23;
  $7 = $47;
  $8 = $48;
  $49 = $7;
  $50 = $8;
  $4 = $49;
  $5 = $50;
  $6 = 0;
  $51 = $5;
  $52 = $51<<2;
  $3 = $52;
  $53 = $3;
  $54 = (__Znwj($53)|0);
  $55 = $54;
 } else {
  $55 = 0;
 }
 HEAP32[$26>>2] = $55;
 $56 = HEAP32[$26>>2]|0;
 $57 = $24;
 $58 = (($56) + ($57<<2)|0);
 $59 = ((($26)) + 8|0);
 HEAP32[$59>>2] = $58;
 $60 = ((($26)) + 4|0);
 HEAP32[$60>>2] = $58;
 $61 = HEAP32[$26>>2]|0;
 $62 = $23;
 $63 = (($61) + ($62<<2)|0);
 $11 = $26;
 $64 = $11;
 $65 = ((($64)) + 12|0);
 $10 = $65;
 $66 = $10;
 $9 = $66;
 $67 = $9;
 HEAP32[$67>>2] = $63;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS2_RS4_EE($this,$__v) {
 $this = $this|0;
 $__v = $__v|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $_Np$i = 0, $__t$i = 0, $__t$i1 = 0, $__t$i2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $__t$i2 = sp + 120|0;
 $__t$i1 = sp + 96|0;
 $__t$i = sp + 12|0;
 $30 = $this;
 $31 = $__v;
 $32 = $30;
 __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE17__annotate_deleteEv($32);
 $29 = $32;
 $33 = $29;
 $34 = ((($33)) + 8|0);
 $28 = $34;
 $35 = $28;
 $27 = $35;
 $36 = $27;
 $37 = HEAP32[$32>>2]|0;
 $38 = ((($32)) + 4|0);
 $39 = HEAP32[$38>>2]|0;
 $40 = $31;
 $41 = ((($40)) + 4|0);
 $22 = $36;
 $23 = $37;
 $24 = $39;
 $25 = $41;
 $42 = $24;
 $43 = $23;
 $44 = $42;
 $45 = $43;
 $46 = (($44) - ($45))|0;
 $47 = (($46|0) / 4)&-1;
 $_Np$i = $47;
 $48 = $_Np$i;
 $49 = $25;
 $50 = HEAP32[$49>>2]|0;
 $51 = (0 - ($48))|0;
 $52 = (($50) + ($51<<2)|0);
 HEAP32[$49>>2] = $52;
 $53 = $25;
 $54 = HEAP32[$53>>2]|0;
 $55 = $23;
 $56 = $_Np$i;
 $57 = $56<<2;
 _memcpy(($54|0),($55|0),($57|0))|0;
 $58 = $31;
 $59 = ((($58)) + 4|0);
 $3 = $32;
 $4 = $59;
 $60 = $3;
 $2 = $60;
 $61 = $2;
 $62 = HEAP32[$61>>2]|0;
 HEAP32[$__t$i2>>2] = $62;
 $63 = $4;
 $0 = $63;
 $64 = $0;
 $65 = HEAP32[$64>>2]|0;
 $66 = $3;
 HEAP32[$66>>2] = $65;
 $1 = $__t$i2;
 $67 = $1;
 $68 = HEAP32[$67>>2]|0;
 $69 = $4;
 HEAP32[$69>>2] = $68;
 $70 = ((($32)) + 4|0);
 $71 = $31;
 $72 = ((($71)) + 8|0);
 $8 = $70;
 $9 = $72;
 $73 = $8;
 $7 = $73;
 $74 = $7;
 $75 = HEAP32[$74>>2]|0;
 HEAP32[$__t$i1>>2] = $75;
 $76 = $9;
 $5 = $76;
 $77 = $5;
 $78 = HEAP32[$77>>2]|0;
 $79 = $8;
 HEAP32[$79>>2] = $78;
 $6 = $__t$i1;
 $80 = $6;
 $81 = HEAP32[$80>>2]|0;
 $82 = $9;
 HEAP32[$82>>2] = $81;
 $12 = $32;
 $83 = $12;
 $84 = ((($83)) + 8|0);
 $11 = $84;
 $85 = $11;
 $10 = $85;
 $86 = $10;
 $87 = $31;
 $15 = $87;
 $88 = $15;
 $89 = ((($88)) + 12|0);
 $14 = $89;
 $90 = $14;
 $13 = $90;
 $91 = $13;
 $19 = $86;
 $20 = $91;
 $92 = $19;
 $18 = $92;
 $93 = $18;
 $94 = HEAP32[$93>>2]|0;
 HEAP32[$__t$i>>2] = $94;
 $95 = $20;
 $16 = $95;
 $96 = $16;
 $97 = HEAP32[$96>>2]|0;
 $98 = $19;
 HEAP32[$98>>2] = $97;
 $17 = $__t$i;
 $99 = $17;
 $100 = HEAP32[$99>>2]|0;
 $101 = $20;
 HEAP32[$101>>2] = $100;
 $102 = $31;
 $103 = ((($102)) + 4|0);
 $104 = HEAP32[$103>>2]|0;
 $105 = $31;
 HEAP32[$105>>2] = $104;
 $21 = $32;
 $106 = $21;
 $107 = ((($106)) + 4|0);
 $108 = HEAP32[$107>>2]|0;
 $109 = HEAP32[$106>>2]|0;
 $110 = $108;
 $111 = $109;
 $112 = (($110) - ($111))|0;
 $113 = (($112|0) / 4)&-1;
 __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE14__annotate_newEj($32,$113);
 $26 = $32;
 STACKTOP = sp;return;
}
function __ZNSt3__114__split_bufferIP15CredictCardBaseRNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = sp;
 $21 = sp + 132|0;
 $28 = sp + 8|0;
 $31 = sp + 133|0;
 $33 = $this;
 $34 = $33;
 $32 = $34;
 $35 = $32;
 $36 = ((($35)) + 4|0);
 $37 = HEAP32[$36>>2]|0;
 $29 = $35;
 $30 = $37;
 $38 = $29;
 $39 = $30;
 ;HEAP8[$28>>0]=HEAP8[$31>>0]|0;
 $26 = $38;
 $27 = $39;
 $40 = $26;
 while(1) {
  $41 = $27;
  $42 = ((($40)) + 8|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = ($41|0)!=($43|0);
  if (!($44)) {
   break;
  }
  $25 = $40;
  $45 = $25;
  $46 = ((($45)) + 12|0);
  $24 = $46;
  $47 = $24;
  $23 = $47;
  $48 = $23;
  $49 = ((($48)) + 4|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = ((($40)) + 8|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = ((($52)) + -4|0);
  HEAP32[$51>>2] = $53;
  $22 = $53;
  $54 = $22;
  $19 = $50;
  $20 = $54;
  $55 = $19;
  $56 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $55;
  $17 = $56;
  $57 = $16;
  $58 = $17;
  $14 = $57;
  $15 = $58;
 }
 $59 = HEAP32[$34>>2]|0;
 $60 = ($59|0)!=(0|0);
 if (!($60)) {
  STACKTOP = sp;return;
 }
 $13 = $34;
 $61 = $13;
 $62 = ((($61)) + 12|0);
 $12 = $62;
 $63 = $12;
 $11 = $63;
 $64 = $11;
 $65 = ((($64)) + 4|0);
 $66 = HEAP32[$65>>2]|0;
 $67 = HEAP32[$34>>2]|0;
 $3 = $34;
 $68 = $3;
 $2 = $68;
 $69 = $2;
 $70 = ((($69)) + 12|0);
 $1 = $70;
 $71 = $1;
 $0 = $71;
 $72 = $0;
 $73 = HEAP32[$72>>2]|0;
 $74 = HEAP32[$68>>2]|0;
 $75 = $73;
 $76 = $74;
 $77 = (($75) - ($76))|0;
 $78 = (($77|0) / 4)&-1;
 $8 = $66;
 $9 = $67;
 $10 = $78;
 $79 = $8;
 $80 = $9;
 $81 = $10;
 $5 = $79;
 $6 = $80;
 $7 = $81;
 $82 = $6;
 $4 = $82;
 $83 = $4;
 __ZdlPv($83);
 STACKTOP = sp;return;
}
function ___clang_call_terminate($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___cxa_begin_catch(($0|0))|0);
 __ZSt9terminatev();
 // unreachable;
}
function __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE17__annotate_deleteEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $19 = $this;
 $20 = $19;
 $18 = $20;
 $21 = $18;
 $22 = HEAP32[$21>>2]|0;
 $17 = $22;
 $23 = $17;
 $16 = $20;
 $24 = $16;
 $25 = HEAP32[$24>>2]|0;
 $15 = $25;
 $26 = $15;
 $4 = $20;
 $27 = $4;
 $3 = $27;
 $28 = $3;
 $2 = $28;
 $29 = $2;
 $30 = ((($29)) + 8|0);
 $1 = $30;
 $31 = $1;
 $0 = $31;
 $32 = $0;
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP32[$28>>2]|0;
 $35 = $33;
 $36 = $34;
 $37 = (($35) - ($36))|0;
 $38 = (($37|0) / 4)&-1;
 $39 = (($26) + ($38<<2)|0);
 $6 = $20;
 $40 = $6;
 $41 = HEAP32[$40>>2]|0;
 $5 = $41;
 $42 = $5;
 $7 = $20;
 $43 = $7;
 $44 = ((($43)) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = HEAP32[$43>>2]|0;
 $47 = $45;
 $48 = $46;
 $49 = (($47) - ($48))|0;
 $50 = (($49|0) / 4)&-1;
 $51 = (($42) + ($50<<2)|0);
 $9 = $20;
 $52 = $9;
 $53 = HEAP32[$52>>2]|0;
 $8 = $53;
 $54 = $8;
 $14 = $20;
 $55 = $14;
 $13 = $55;
 $56 = $13;
 $12 = $56;
 $57 = $12;
 $58 = ((($57)) + 8|0);
 $11 = $58;
 $59 = $11;
 $10 = $59;
 $60 = $10;
 $61 = HEAP32[$60>>2]|0;
 $62 = HEAP32[$56>>2]|0;
 $63 = $61;
 $64 = $62;
 $65 = (($63) - ($64))|0;
 $66 = (($65|0) / 4)&-1;
 $67 = (($54) + ($66<<2)|0);
 __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($20,$23,$39,$51,$67);
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE14__annotate_newEj($this,$__current_size) {
 $this = $this|0;
 $__current_size = $__current_size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = $this;
 $19 = $__current_size;
 $20 = $18;
 $17 = $20;
 $21 = $17;
 $22 = HEAP32[$21>>2]|0;
 $16 = $22;
 $23 = $16;
 $15 = $20;
 $24 = $15;
 $25 = HEAP32[$24>>2]|0;
 $14 = $25;
 $26 = $14;
 $4 = $20;
 $27 = $4;
 $3 = $27;
 $28 = $3;
 $2 = $28;
 $29 = $2;
 $30 = ((($29)) + 8|0);
 $1 = $30;
 $31 = $1;
 $0 = $31;
 $32 = $0;
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP32[$28>>2]|0;
 $35 = $33;
 $36 = $34;
 $37 = (($35) - ($36))|0;
 $38 = (($37|0) / 4)&-1;
 $39 = (($26) + ($38<<2)|0);
 $6 = $20;
 $40 = $6;
 $41 = HEAP32[$40>>2]|0;
 $5 = $41;
 $42 = $5;
 $11 = $20;
 $43 = $11;
 $10 = $43;
 $44 = $10;
 $9 = $44;
 $45 = $9;
 $46 = ((($45)) + 8|0);
 $8 = $46;
 $47 = $8;
 $7 = $47;
 $48 = $7;
 $49 = HEAP32[$48>>2]|0;
 $50 = HEAP32[$44>>2]|0;
 $51 = $49;
 $52 = $50;
 $53 = (($51) - ($52))|0;
 $54 = (($53|0) / 4)&-1;
 $55 = (($42) + ($54<<2)|0);
 $13 = $20;
 $56 = $13;
 $57 = HEAP32[$56>>2]|0;
 $12 = $57;
 $58 = $12;
 $59 = $19;
 $60 = (($58) + ($59<<2)|0);
 __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($20,$23,$39,$55,$60);
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($this,$__beg,$__end,$__old_mid,$__new_mid) {
 $this = $this|0;
 $__beg = $__beg|0;
 $__end = $__end|0;
 $__old_mid = $__old_mid|0;
 $__new_mid = $__new_mid|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $__beg;
 $2 = $__end;
 $3 = $__old_mid;
 $4 = $__new_mid;
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE8max_sizeEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $8 = sp + 76|0;
 $11 = sp + 8|0;
 $13 = sp + 77|0;
 $18 = sp + 32|0;
 $19 = sp + 36|0;
 $17 = $this;
 $20 = $17;
 $16 = $20;
 $21 = $16;
 $22 = ((($21)) + 8|0);
 $15 = $22;
 $23 = $15;
 $14 = $23;
 $24 = $14;
 $12 = $24;
 $25 = $12;
 ;HEAP8[$11>>0]=HEAP8[$13>>0]|0;
 $10 = $25;
 $26 = $10;
 $9 = $26;
 HEAP32[$18>>2] = 1073741823;
 $27 = (4294967295 / 2)&-1;
 HEAP32[$19>>2] = $27;
 $6 = $18;
 $7 = $19;
 $28 = $6;
 $29 = $7;
 ;HEAP8[$5>>0]=HEAP8[$8>>0]|0;
 $3 = $28;
 $4 = $29;
 $30 = $4;
 $31 = $3;
 $0 = $5;
 $1 = $30;
 $2 = $31;
 $32 = $1;
 $33 = HEAP32[$32>>2]|0;
 $34 = $2;
 $35 = HEAP32[$34>>2]|0;
 $36 = ($33>>>0)<($35>>>0);
 $37 = $4;
 $38 = $3;
 $39 = $36 ? $37 : $38;
 $40 = HEAP32[$39>>2]|0;
 STACKTOP = sp;return ($40|0);
}
function __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEEC2EjjS5_($this,$__cap,$__start,$__a) {
 $this = $this|0;
 $__cap = $__cap|0;
 $__start = $__start|0;
 $__a = $__a|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $16 = sp + 4|0;
 $20 = sp + 24|0;
 $22 = $this;
 $23 = $__cap;
 $24 = $__start;
 $25 = $__a;
 $26 = $22;
 $27 = ((($26)) + 12|0);
 $28 = $25;
 $19 = $27;
 HEAP32[$20>>2] = 0;
 $21 = $28;
 $29 = $19;
 $18 = $20;
 $30 = $18;
 $31 = HEAP32[$30>>2]|0;
 $32 = $21;
 $12 = $32;
 $33 = $12;
 $15 = $29;
 HEAP32[$16>>2] = $31;
 $17 = $33;
 $34 = $15;
 $14 = $16;
 $35 = $14;
 $36 = HEAP32[$35>>2]|0;
 HEAP32[$34>>2] = $36;
 $37 = ((($34)) + 4|0);
 $38 = $17;
 $13 = $38;
 $39 = $13;
 HEAP32[$37>>2] = $39;
 $40 = $23;
 $41 = ($40|0)!=(0);
 if ($41) {
  $2 = $26;
  $42 = $2;
  $43 = ((($42)) + 12|0);
  $1 = $43;
  $44 = $1;
  $0 = $44;
  $45 = $0;
  $46 = ((($45)) + 4|0);
  $47 = HEAP32[$46>>2]|0;
  $48 = $23;
  $7 = $47;
  $8 = $48;
  $49 = $7;
  $50 = $8;
  $4 = $49;
  $5 = $50;
  $6 = 0;
  $51 = $5;
  $52 = $51<<2;
  $3 = $52;
  $53 = $3;
  $54 = (__Znwj($53)|0);
  $55 = $54;
 } else {
  $55 = 0;
 }
 HEAP32[$26>>2] = $55;
 $56 = HEAP32[$26>>2]|0;
 $57 = $24;
 $58 = (($56) + ($57<<2)|0);
 $59 = ((($26)) + 8|0);
 HEAP32[$59>>2] = $58;
 $60 = ((($26)) + 4|0);
 HEAP32[$60>>2] = $58;
 $61 = HEAP32[$26>>2]|0;
 $62 = $23;
 $63 = (($61) + ($62<<2)|0);
 $11 = $26;
 $64 = $11;
 $65 = ((($64)) + 12|0);
 $10 = $65;
 $66 = $10;
 $9 = $66;
 $67 = $9;
 HEAP32[$67>>2] = $63;
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS2_RS4_EE($this,$__v) {
 $this = $this|0;
 $__v = $__v|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $_Np$i = 0, $__t$i = 0, $__t$i1 = 0, $__t$i2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $__t$i2 = sp + 120|0;
 $__t$i1 = sp + 96|0;
 $__t$i = sp + 12|0;
 $30 = $this;
 $31 = $__v;
 $32 = $30;
 __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE17__annotate_deleteEv($32);
 $29 = $32;
 $33 = $29;
 $34 = ((($33)) + 8|0);
 $28 = $34;
 $35 = $28;
 $27 = $35;
 $36 = $27;
 $37 = HEAP32[$32>>2]|0;
 $38 = ((($32)) + 4|0);
 $39 = HEAP32[$38>>2]|0;
 $40 = $31;
 $41 = ((($40)) + 4|0);
 $22 = $36;
 $23 = $37;
 $24 = $39;
 $25 = $41;
 $42 = $24;
 $43 = $23;
 $44 = $42;
 $45 = $43;
 $46 = (($44) - ($45))|0;
 $47 = (($46|0) / 4)&-1;
 $_Np$i = $47;
 $48 = $_Np$i;
 $49 = $25;
 $50 = HEAP32[$49>>2]|0;
 $51 = (0 - ($48))|0;
 $52 = (($50) + ($51<<2)|0);
 HEAP32[$49>>2] = $52;
 $53 = $25;
 $54 = HEAP32[$53>>2]|0;
 $55 = $23;
 $56 = $_Np$i;
 $57 = $56<<2;
 _memcpy(($54|0),($55|0),($57|0))|0;
 $58 = $31;
 $59 = ((($58)) + 4|0);
 $3 = $32;
 $4 = $59;
 $60 = $3;
 $2 = $60;
 $61 = $2;
 $62 = HEAP32[$61>>2]|0;
 HEAP32[$__t$i2>>2] = $62;
 $63 = $4;
 $0 = $63;
 $64 = $0;
 $65 = HEAP32[$64>>2]|0;
 $66 = $3;
 HEAP32[$66>>2] = $65;
 $1 = $__t$i2;
 $67 = $1;
 $68 = HEAP32[$67>>2]|0;
 $69 = $4;
 HEAP32[$69>>2] = $68;
 $70 = ((($32)) + 4|0);
 $71 = $31;
 $72 = ((($71)) + 8|0);
 $8 = $70;
 $9 = $72;
 $73 = $8;
 $7 = $73;
 $74 = $7;
 $75 = HEAP32[$74>>2]|0;
 HEAP32[$__t$i1>>2] = $75;
 $76 = $9;
 $5 = $76;
 $77 = $5;
 $78 = HEAP32[$77>>2]|0;
 $79 = $8;
 HEAP32[$79>>2] = $78;
 $6 = $__t$i1;
 $80 = $6;
 $81 = HEAP32[$80>>2]|0;
 $82 = $9;
 HEAP32[$82>>2] = $81;
 $12 = $32;
 $83 = $12;
 $84 = ((($83)) + 8|0);
 $11 = $84;
 $85 = $11;
 $10 = $85;
 $86 = $10;
 $87 = $31;
 $15 = $87;
 $88 = $15;
 $89 = ((($88)) + 12|0);
 $14 = $89;
 $90 = $14;
 $13 = $90;
 $91 = $13;
 $19 = $86;
 $20 = $91;
 $92 = $19;
 $18 = $92;
 $93 = $18;
 $94 = HEAP32[$93>>2]|0;
 HEAP32[$__t$i>>2] = $94;
 $95 = $20;
 $16 = $95;
 $96 = $16;
 $97 = HEAP32[$96>>2]|0;
 $98 = $19;
 HEAP32[$98>>2] = $97;
 $17 = $__t$i;
 $99 = $17;
 $100 = HEAP32[$99>>2]|0;
 $101 = $20;
 HEAP32[$101>>2] = $100;
 $102 = $31;
 $103 = ((($102)) + 4|0);
 $104 = HEAP32[$103>>2]|0;
 $105 = $31;
 HEAP32[$105>>2] = $104;
 $21 = $32;
 $106 = $21;
 $107 = ((($106)) + 4|0);
 $108 = HEAP32[$107>>2]|0;
 $109 = HEAP32[$106>>2]|0;
 $110 = $108;
 $111 = $109;
 $112 = (($110) - ($111))|0;
 $113 = (($112|0) / 4)&-1;
 __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE14__annotate_newEj($32,$113);
 $26 = $32;
 STACKTOP = sp;return;
}
function __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 144|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = sp;
 $21 = sp + 132|0;
 $28 = sp + 8|0;
 $31 = sp + 133|0;
 $33 = $this;
 $34 = $33;
 $32 = $34;
 $35 = $32;
 $36 = ((($35)) + 4|0);
 $37 = HEAP32[$36>>2]|0;
 $29 = $35;
 $30 = $37;
 $38 = $29;
 $39 = $30;
 ;HEAP8[$28>>0]=HEAP8[$31>>0]|0;
 $26 = $38;
 $27 = $39;
 $40 = $26;
 while(1) {
  $41 = $27;
  $42 = ((($40)) + 8|0);
  $43 = HEAP32[$42>>2]|0;
  $44 = ($41|0)!=($43|0);
  if (!($44)) {
   break;
  }
  $25 = $40;
  $45 = $25;
  $46 = ((($45)) + 12|0);
  $24 = $46;
  $47 = $24;
  $23 = $47;
  $48 = $23;
  $49 = ((($48)) + 4|0);
  $50 = HEAP32[$49>>2]|0;
  $51 = ((($40)) + 8|0);
  $52 = HEAP32[$51>>2]|0;
  $53 = ((($52)) + -4|0);
  HEAP32[$51>>2] = $53;
  $22 = $53;
  $54 = $22;
  $19 = $50;
  $20 = $54;
  $55 = $19;
  $56 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $55;
  $17 = $56;
  $57 = $16;
  $58 = $17;
  $14 = $57;
  $15 = $58;
 }
 $59 = HEAP32[$34>>2]|0;
 $60 = ($59|0)!=(0|0);
 if (!($60)) {
  STACKTOP = sp;return;
 }
 $13 = $34;
 $61 = $13;
 $62 = ((($61)) + 12|0);
 $12 = $62;
 $63 = $12;
 $11 = $63;
 $64 = $11;
 $65 = ((($64)) + 4|0);
 $66 = HEAP32[$65>>2]|0;
 $67 = HEAP32[$34>>2]|0;
 $3 = $34;
 $68 = $3;
 $2 = $68;
 $69 = $2;
 $70 = ((($69)) + 12|0);
 $1 = $70;
 $71 = $1;
 $0 = $71;
 $72 = $0;
 $73 = HEAP32[$72>>2]|0;
 $74 = HEAP32[$68>>2]|0;
 $75 = $73;
 $76 = $74;
 $77 = (($75) - ($76))|0;
 $78 = (($77|0) / 4)&-1;
 $8 = $66;
 $9 = $67;
 $10 = $78;
 $79 = $8;
 $80 = $9;
 $81 = $10;
 $5 = $79;
 $6 = $80;
 $7 = $81;
 $82 = $6;
 $4 = $82;
 $83 = $4;
 __ZdlPv($83);
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE17__annotate_deleteEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $19 = $this;
 $20 = $19;
 $18 = $20;
 $21 = $18;
 $22 = HEAP32[$21>>2]|0;
 $17 = $22;
 $23 = $17;
 $16 = $20;
 $24 = $16;
 $25 = HEAP32[$24>>2]|0;
 $15 = $25;
 $26 = $15;
 $4 = $20;
 $27 = $4;
 $3 = $27;
 $28 = $3;
 $2 = $28;
 $29 = $2;
 $30 = ((($29)) + 8|0);
 $1 = $30;
 $31 = $1;
 $0 = $31;
 $32 = $0;
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP32[$28>>2]|0;
 $35 = $33;
 $36 = $34;
 $37 = (($35) - ($36))|0;
 $38 = (($37|0) / 4)&-1;
 $39 = (($26) + ($38<<2)|0);
 $6 = $20;
 $40 = $6;
 $41 = HEAP32[$40>>2]|0;
 $5 = $41;
 $42 = $5;
 $7 = $20;
 $43 = $7;
 $44 = ((($43)) + 4|0);
 $45 = HEAP32[$44>>2]|0;
 $46 = HEAP32[$43>>2]|0;
 $47 = $45;
 $48 = $46;
 $49 = (($47) - ($48))|0;
 $50 = (($49|0) / 4)&-1;
 $51 = (($42) + ($50<<2)|0);
 $9 = $20;
 $52 = $9;
 $53 = HEAP32[$52>>2]|0;
 $8 = $53;
 $54 = $8;
 $14 = $20;
 $55 = $14;
 $13 = $55;
 $56 = $13;
 $12 = $56;
 $57 = $12;
 $58 = ((($57)) + 8|0);
 $11 = $58;
 $59 = $11;
 $10 = $59;
 $60 = $10;
 $61 = HEAP32[$60>>2]|0;
 $62 = HEAP32[$56>>2]|0;
 $63 = $61;
 $64 = $62;
 $65 = (($63) - ($64))|0;
 $66 = (($65|0) / 4)&-1;
 $67 = (($54) + ($66<<2)|0);
 __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($20,$23,$39,$51,$67);
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE14__annotate_newEj($this,$__current_size) {
 $this = $this|0;
 $__current_size = $__current_size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = $this;
 $19 = $__current_size;
 $20 = $18;
 $17 = $20;
 $21 = $17;
 $22 = HEAP32[$21>>2]|0;
 $16 = $22;
 $23 = $16;
 $15 = $20;
 $24 = $15;
 $25 = HEAP32[$24>>2]|0;
 $14 = $25;
 $26 = $14;
 $4 = $20;
 $27 = $4;
 $3 = $27;
 $28 = $3;
 $2 = $28;
 $29 = $2;
 $30 = ((($29)) + 8|0);
 $1 = $30;
 $31 = $1;
 $0 = $31;
 $32 = $0;
 $33 = HEAP32[$32>>2]|0;
 $34 = HEAP32[$28>>2]|0;
 $35 = $33;
 $36 = $34;
 $37 = (($35) - ($36))|0;
 $38 = (($37|0) / 4)&-1;
 $39 = (($26) + ($38<<2)|0);
 $6 = $20;
 $40 = $6;
 $41 = HEAP32[$40>>2]|0;
 $5 = $41;
 $42 = $5;
 $11 = $20;
 $43 = $11;
 $10 = $43;
 $44 = $10;
 $9 = $44;
 $45 = $9;
 $46 = ((($45)) + 8|0);
 $8 = $46;
 $47 = $8;
 $7 = $47;
 $48 = $7;
 $49 = HEAP32[$48>>2]|0;
 $50 = HEAP32[$44>>2]|0;
 $51 = $49;
 $52 = $50;
 $53 = (($51) - ($52))|0;
 $54 = (($53|0) / 4)&-1;
 $55 = (($42) + ($54<<2)|0);
 $13 = $20;
 $56 = $13;
 $57 = HEAP32[$56>>2]|0;
 $12 = $57;
 $58 = $12;
 $59 = $19;
 $60 = (($58) + ($59<<2)|0);
 __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($20,$23,$39,$55,$60);
 STACKTOP = sp;return;
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($this,$__beg,$__end,$__old_mid,$__new_mid) {
 $this = $this|0;
 $__beg = $__beg|0;
 $__end = $__end|0;
 $__old_mid = $__old_mid|0;
 $__new_mid = $__new_mid|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $__beg;
 $2 = $__end;
 $3 = $__old_mid;
 $4 = $__new_mid;
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (784|0);
}
function __ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE12fromWireTypeES3_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (872|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEENS3_I15CredictCardBaseEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (888|0);
}
function __ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE12fromWireTypeES3_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI14CredictCardMgrEENS3_I4BillEENS3_I15CredictCardBaseEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (952|0);
}
function __ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI14CredictCardMgrEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1016|0);
}
function __ZN10emscripten8internal11BindingTypeIP14CredictCardMgrE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN14CredictCardMgrC2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 76|0;
 $6 = sp + 64|0;
 $13 = sp;
 $16 = sp + 12|0;
 $20 = $this;
 $23 = $20;
 $19 = $23;
 $24 = $19;
 $18 = $24;
 $25 = $18;
 $17 = $25;
 HEAP32[$25>>2] = 0;
 $26 = ((($25)) + 4|0);
 HEAP32[$26>>2] = 0;
 $27 = ((($25)) + 8|0);
 $15 = $27;
 HEAP32[$16>>2] = 0;
 $28 = $15;
 $14 = $16;
 $29 = $14;
 $30 = HEAP32[$29>>2]|0;
 $12 = $28;
 HEAP32[$13>>2] = $30;
 $31 = $12;
 $11 = $31;
 $10 = $13;
 $32 = $10;
 $33 = HEAP32[$32>>2]|0;
 HEAP32[$31>>2] = $33;
 $34 = ((($23)) + 12|0);
 $9 = $34;
 $35 = $9;
 $8 = $35;
 $36 = $8;
 $7 = $36;
 HEAP32[$36>>2] = 0;
 $37 = ((($36)) + 4|0);
 HEAP32[$37>>2] = 0;
 $38 = ((($36)) + 8|0);
 $5 = $38;
 HEAP32[$6>>2] = 0;
 $39 = $5;
 $4 = $6;
 $40 = $4;
 $41 = HEAP32[$40>>2]|0;
 $2 = $39;
 HEAP32[$3>>2] = $41;
 $42 = $2;
 $1 = $42;
 $0 = $3;
 $43 = $0;
 $44 = HEAP32[$43>>2]|0;
 HEAP32[$42>>2] = $44;
 $45 = ((($23)) + 24|0);
 HEAP32[$45>>2] = 0;
 __THREW__ = 0;
 invoke_vi(127,0);
 $46 = __THREW__; __THREW__ = 0;
 $47 = $46&1;
 if ($47) {
  $48 = ___cxa_find_matching_catch()|0;
  $49 = tempRet0;
  $21 = $48;
  $22 = $49;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($34);
  __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEED2Ev($23);
  $50 = $21;
  $51 = $22;
  ___resumeException($50|0);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 __ZNSt3__113__vector_baseIP15CredictCardBaseNS_9allocatorIS2_EEED2Ev($1);
 STACKTOP = sp;return;
}
function __ZNSt3__113__vector_baseIP15CredictCardBaseNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = sp;
 $21 = sp + 116|0;
 $29 = $this;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = ($31|0)!=(0|0);
 if (!($32)) {
  STACKTOP = sp;return;
 }
 $28 = $30;
 $33 = $28;
 $34 = HEAP32[$33>>2]|0;
 $26 = $33;
 $27 = $34;
 $35 = $26;
 while(1) {
  $36 = $27;
  $37 = ((($35)) + 4|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = ($36|0)!=($38|0);
  if (!($39)) {
   break;
  }
  $25 = $35;
  $40 = $25;
  $41 = ((($40)) + 8|0);
  $24 = $41;
  $42 = $24;
  $23 = $42;
  $43 = $23;
  $44 = ((($35)) + 4|0);
  $45 = HEAP32[$44>>2]|0;
  $46 = ((($45)) + -4|0);
  HEAP32[$44>>2] = $46;
  $22 = $46;
  $47 = $22;
  $19 = $43;
  $20 = $47;
  $48 = $19;
  $49 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $48;
  $17 = $49;
  $50 = $16;
  $51 = $17;
  $14 = $50;
  $15 = $51;
 }
 $6 = $30;
 $52 = $6;
 $53 = ((($52)) + 8|0);
 $5 = $53;
 $54 = $5;
 $4 = $54;
 $55 = $4;
 $56 = HEAP32[$30>>2]|0;
 $3 = $30;
 $57 = $3;
 $2 = $57;
 $58 = $2;
 $59 = ((($58)) + 8|0);
 $1 = $59;
 $60 = $1;
 $0 = $60;
 $61 = $0;
 $62 = HEAP32[$61>>2]|0;
 $63 = HEAP32[$57>>2]|0;
 $64 = $62;
 $65 = $63;
 $66 = (($64) - ($65))|0;
 $67 = (($66|0) / 4)&-1;
 $11 = $55;
 $12 = $56;
 $13 = $67;
 $68 = $11;
 $69 = $12;
 $70 = $13;
 $8 = $68;
 $9 = $69;
 $10 = $70;
 $71 = $9;
 $7 = $71;
 $72 = $7;
 __ZdlPv($72);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal11LightTypeIDIPK14CredictCardMgrE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1040|0);
}
function __ZN10emscripten8internal11LightTypeIDIP14CredictCardMgrE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (792|0);
}
function __ZN10emscripten8internal11LightTypeIDI14CredictCardMgrE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (832|0);
}
function __ZN14CredictCardMgrD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 12|0);
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($2);
 __ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEED2Ev($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14getLightTypeIDI14CredictCardMgrEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 STACKTOP = sp;return (832|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI18CredictCardHNICashEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1088|0);
}
function __ZN10emscripten8internal11BindingTypeIONSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS1_IS8_EUt_E($agg$result,$wt) {
 $agg$result = $agg$result|0;
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 __ZN10emscripten8internal11BindingTypeINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS9_Ut_E($agg$result,$1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal11BindingTypeIP18CredictCardHNICashE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE12fromWireTypeEPNS9_Ut_E($agg$result,$v) {
 $agg$result = $agg$result|0;
 $v = $v|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $6 = $v;
 $7 = $6;
 $8 = ((($7)) + 4|0);
 $9 = $6;
 $10 = HEAP32[$9>>2]|0;
 $3 = $agg$result;
 $4 = $8;
 $5 = $10;
 $11 = $3;
 $2 = $11;
 $12 = $2;
 $1 = $12;
 $13 = $1;
 $0 = $13;
 $14 = $4;
 $15 = $5;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcj($11,$14,$15);
 STACKTOP = sp;return;
}
function __ZN18CredictCardHNICashC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE($this,$p_name) {
 $this = $this|0;
 $p_name = $p_name|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = sp;
 $0 = $this;
 $4 = $0;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEC2ERKS5_($1,$p_name);
 __THREW__ = 0;
 invoke_viii(109,($4|0),($1|0),1);
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $8 = ___cxa_find_matching_catch()|0;
  $9 = tempRet0;
  $2 = $8;
  $3 = $9;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $10 = $2;
  $11 = $3;
  ___resumeException($10|0);
  // unreachable;
 } else {
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $7 = 128;
  HEAP32[$4>>2] = $7;
  STACKTOP = sp;return;
 }
}
function __ZN15CredictCardBaseC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi($this,$p_name,$p_dueDate) {
 $this = $this|0;
 $p_name = $p_name|0;
 $p_dueDate = $p_dueDate|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $__a$i$i = 0, $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $10 = sp + 120|0;
 $13 = sp + 108|0;
 $20 = sp + 36|0;
 $23 = sp + 24|0;
 $30 = sp + 40|0;
 $33 = sp + 52|0;
 $37 = $this;
 $38 = $p_dueDate;
 $41 = $37;
 $42 = 736;
 HEAP32[$41>>2] = $42;
 $43 = ((($41)) + 4|0);
 $44 = $38;
 HEAP32[$43>>2] = $44;
 $45 = ((($41)) + 8|0);
 HEAP32[$45>>2] = 0;
 $46 = ((($41)) + 12|0);
 $36 = $46;
 $47 = $36;
 $35 = $47;
 $48 = $35;
 $34 = $48;
 HEAP32[$48>>2] = 0;
 $49 = ((($48)) + 4|0);
 HEAP32[$49>>2] = 0;
 $50 = ((($48)) + 8|0);
 $32 = $50;
 HEAP32[$33>>2] = 0;
 $51 = $32;
 $31 = $33;
 $52 = $31;
 $53 = HEAP32[$52>>2]|0;
 $29 = $51;
 HEAP32[$30>>2] = $53;
 $54 = $29;
 $28 = $54;
 $27 = $30;
 $55 = $27;
 $56 = HEAP32[$55>>2]|0;
 HEAP32[$54>>2] = $56;
 $57 = ((($41)) + 24|0);
 $26 = $57;
 $58 = $26;
 $25 = $58;
 $59 = $25;
 $24 = $59;
 HEAP32[$59>>2] = 0;
 $60 = ((($59)) + 4|0);
 HEAP32[$60>>2] = 0;
 $61 = ((($59)) + 8|0);
 $22 = $61;
 HEAP32[$23>>2] = 0;
 $62 = $22;
 $21 = $23;
 $63 = $21;
 $64 = HEAP32[$63>>2]|0;
 $19 = $62;
 HEAP32[$20>>2] = $64;
 $65 = $19;
 $18 = $65;
 $17 = $20;
 $66 = $17;
 $67 = HEAP32[$66>>2]|0;
 HEAP32[$65>>2] = $67;
 $68 = ((($41)) + 36|0);
 $16 = $68;
 $69 = $16;
 $15 = $69;
 $70 = $15;
 $14 = $70;
 HEAP32[$70>>2] = 0;
 $71 = ((($70)) + 4|0);
 HEAP32[$71>>2] = 0;
 $72 = ((($70)) + 8|0);
 $12 = $72;
 HEAP32[$13>>2] = 0;
 $73 = $12;
 $11 = $13;
 $74 = $11;
 $75 = HEAP32[$74>>2]|0;
 $9 = $73;
 HEAP32[$10>>2] = $75;
 $76 = $9;
 $8 = $76;
 $7 = $10;
 $77 = $7;
 $78 = HEAP32[$77>>2]|0;
 HEAP32[$76>>2] = $78;
 $79 = ((($41)) + 48|0);
 $6 = $79;
 $80 = $6;
 $5 = $80;
 $81 = $5;
 $4 = $81;
 $82 = $4;
 $3 = $82;
 $2 = $80;
 $83 = $2;
 $1 = $83;
 $84 = $1;
 $0 = $84;
 $85 = $0;
 $__a$i$i = $85;
 $__i$i$i = 0;
 while(1) {
  $86 = $__i$i$i;
  $87 = ($86>>>0)<(3);
  if (!($87)) {
   break;
  }
  $88 = $__i$i$i;
  $89 = $__a$i$i;
  $90 = (($89) + ($88<<2)|0);
  HEAP32[$90>>2] = 0;
  $91 = $__i$i$i;
  $92 = (($91) + 1)|0;
  $__i$i$i = $92;
 }
 $93 = ((($41)) + 48|0);
 __THREW__ = 0;
 (invoke_iii(128,($93|0),($p_name|0))|0);
 $94 = __THREW__; __THREW__ = 0;
 $95 = $94&1;
 if ($95) {
  $96 = ___cxa_find_matching_catch()|0;
  $97 = tempRet0;
  $39 = $96;
  $40 = $97;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($79);
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($68);
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($57);
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($46);
  $98 = $39;
  $99 = $40;
  ___resumeException($98|0);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal11LightTypeIDIPK18CredictCardHNICashE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1304|0);
}
function __ZN10emscripten8internal11LightTypeIDIP18CredictCardHNICashE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1096|0);
}
function __ZN10emscripten8internal11LightTypeIDI18CredictCardHNICashE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (168|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_18CredictCardHNICashEEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerI18CredictCardHNICashS1_EEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14getLightTypeIDI18CredictCardHNICashEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($2)) + -4|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI13CredictCardYSEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1352|0);
}
function __ZN10emscripten8internal11BindingTypeIP13CredictCardYSE12fromWireTypeES3_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13CredictCardYSEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1408|0);
}
function __ZN10emscripten8internal11BindingTypeIP13CredictCardYSE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN13CredictCardYSC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE($this,$p_name) {
 $this = $this|0;
 $p_name = $p_name|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = sp;
 $0 = $this;
 $4 = $0;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEC2ERKS5_($1,$p_name);
 __THREW__ = 0;
 invoke_viii(109,($4|0),($1|0),1);
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $8 = ___cxa_find_matching_catch()|0;
  $9 = tempRet0;
  $2 = $8;
  $3 = $9;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $10 = $2;
  $11 = $3;
  ___resumeException($10|0);
  // unreachable;
 } else {
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $7 = 72;
  HEAP32[$4>>2] = $7;
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal11LightTypeIDIPK13CredictCardYSE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1448|0);
}
function __ZN10emscripten8internal11LightTypeIDIP13CredictCardYSE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1360|0);
}
function __ZN10emscripten8internal11LightTypeIDI13CredictCardYSE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (104|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_13CredictCardYSEEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerI13CredictCardYSS1_EEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14getLightTypeIDI13CredictCardYSEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($2)) + -4|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI13CredictCardHNEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1496|0);
}
function __ZN10emscripten8internal11BindingTypeIP13CredictCardHNE12fromWireTypeES3_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13CredictCardHNEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1552|0);
}
function __ZN10emscripten8internal11BindingTypeIP13CredictCardHNE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN13CredictCardHNC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE($this,$p_name) {
 $this = $this|0;
 $p_name = $p_name|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = sp;
 $0 = $this;
 $4 = $0;
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEC2ERKS5_($1,$p_name);
 __THREW__ = 0;
 invoke_viii(109,($4|0),($1|0),1);
 $5 = __THREW__; __THREW__ = 0;
 $6 = $5&1;
 if ($6) {
  $8 = ___cxa_find_matching_catch()|0;
  $9 = tempRet0;
  $2 = $8;
  $3 = $9;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $10 = $2;
  $11 = $3;
  ___resumeException($10|0);
  // unreachable;
 } else {
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($1);
  $7 = 16;
  HEAP32[$4>>2] = $7;
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal11LightTypeIDIPK13CredictCardHNE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1592|0);
}
function __ZN10emscripten8internal11LightTypeIDIP13CredictCardHNE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1504|0);
}
function __ZN10emscripten8internal11LightTypeIDI13CredictCardHNE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (48|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_13CredictCardHNEEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten4baseI15CredictCardBaseE14convertPointerI13CredictCardHNS1_EEPT0_PT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14getLightTypeIDI13CredictCardHNEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($2)) + -4|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEERNSt3__16vectorIP4BillNS6_9allocatorIS9_EEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1640|0);
}
function __ZN10emscripten8internal18GenericBindingTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeEPS8_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE17__annotate_shrinkEj($this,$__old_size) {
 $this = $this|0;
 $__old_size = $__old_size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $14 = $this;
 $15 = $__old_size;
 $16 = $14;
 $13 = $16;
 $17 = $13;
 $18 = HEAP32[$17>>2]|0;
 $12 = $18;
 $19 = $12;
 $11 = $16;
 $20 = $11;
 $21 = HEAP32[$20>>2]|0;
 $10 = $21;
 $22 = $10;
 $4 = $16;
 $23 = $4;
 $3 = $23;
 $24 = $3;
 $2 = $24;
 $25 = $2;
 $26 = ((($25)) + 8|0);
 $1 = $26;
 $27 = $1;
 $0 = $27;
 $28 = $0;
 $29 = HEAP32[$28>>2]|0;
 $30 = HEAP32[$24>>2]|0;
 $31 = $29;
 $32 = $30;
 $33 = (($31) - ($32))|0;
 $34 = (($33|0) / 4)&-1;
 $35 = (($22) + ($34<<2)|0);
 $6 = $16;
 $36 = $6;
 $37 = HEAP32[$36>>2]|0;
 $5 = $37;
 $38 = $5;
 $39 = $15;
 $40 = (($38) + ($39<<2)|0);
 $8 = $16;
 $41 = $8;
 $42 = HEAP32[$41>>2]|0;
 $7 = $42;
 $43 = $7;
 $9 = $16;
 $44 = $9;
 $45 = ((($44)) + 4|0);
 $46 = HEAP32[$45>>2]|0;
 $47 = HEAP32[$44>>2]|0;
 $48 = $46;
 $49 = $47;
 $50 = (($48) - ($49))|0;
 $51 = (($50|0) / 4)&-1;
 $52 = (($43) + ($51<<2)|0);
 __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE31__annotate_contiguous_containerEPKvS7_S7_S7_($16,$19,$35,$40,$52);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI15CredictCardBaseEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1896|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1912|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI15CredictCardBaseEENS3_I4BillEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1928|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI15CredictCardBaseEEONSt3__112basic_stringIcNS6_11char_traitsIcEENS6_9allocatorIcEEEEOiEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1960|0);
}
function __ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 $2 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11LightTypeIDIPK15CredictCardBaseE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1992|0);
}
function __ZN10emscripten8internal11LightTypeIDIP15CredictCardBaseE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (904|0);
}
function __ZN10emscripten8internal11LightTypeIDI15CredictCardBaseE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (688|0);
}
function __ZN10emscripten8internal14getLightTypeIDI15CredictCardBaseEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($2)) + -4|0);
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZNSt3__113__vector_baseIP4BillNS_9allocatorIS2_EEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $18 = sp;
 $21 = sp + 116|0;
 $29 = $this;
 $30 = $29;
 $31 = HEAP32[$30>>2]|0;
 $32 = ($31|0)!=(0|0);
 if (!($32)) {
  STACKTOP = sp;return;
 }
 $28 = $30;
 $33 = $28;
 $34 = HEAP32[$33>>2]|0;
 $26 = $33;
 $27 = $34;
 $35 = $26;
 while(1) {
  $36 = $27;
  $37 = ((($35)) + 4|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = ($36|0)!=($38|0);
  if (!($39)) {
   break;
  }
  $25 = $35;
  $40 = $25;
  $41 = ((($40)) + 8|0);
  $24 = $41;
  $42 = $24;
  $23 = $42;
  $43 = $23;
  $44 = ((($35)) + 4|0);
  $45 = HEAP32[$44>>2]|0;
  $46 = ((($45)) + -4|0);
  HEAP32[$44>>2] = $46;
  $22 = $46;
  $47 = $22;
  $19 = $43;
  $20 = $47;
  $48 = $19;
  $49 = $20;
  ;HEAP8[$18>>0]=HEAP8[$21>>0]|0;
  $16 = $48;
  $17 = $49;
  $50 = $16;
  $51 = $17;
  $14 = $50;
  $15 = $51;
 }
 $6 = $30;
 $52 = $6;
 $53 = ((($52)) + 8|0);
 $5 = $53;
 $54 = $5;
 $4 = $54;
 $55 = $4;
 $56 = HEAP32[$30>>2]|0;
 $3 = $30;
 $57 = $3;
 $2 = $57;
 $58 = $2;
 $59 = ((($58)) + 8|0);
 $1 = $59;
 $60 = $1;
 $0 = $60;
 $61 = $0;
 $62 = HEAP32[$61>>2]|0;
 $63 = HEAP32[$57>>2]|0;
 $64 = $62;
 $65 = $63;
 $66 = (($64) - ($65))|0;
 $67 = (($66|0) / 4)&-1;
 $11 = $55;
 $12 = $56;
 $13 = $67;
 $68 = $11;
 $69 = $12;
 $70 = $13;
 $8 = $68;
 $9 = $69;
 $10 = $70;
 $71 = $9;
 $7 = $71;
 $72 = $7;
 __ZdlPv($72);
 STACKTOP = sp;return;
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE9push_backERKS2_($this,$__x) {
 $this = $this|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__annotator = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $8 = sp;
 $13 = sp + 89|0;
 $__annotator = sp + 88|0;
 $21 = $this;
 $22 = $__x;
 $23 = $21;
 $24 = ((($23)) + 4|0);
 $25 = HEAP32[$24>>2]|0;
 $20 = $23;
 $26 = $20;
 $27 = ((($26)) + 8|0);
 $19 = $27;
 $28 = $19;
 $18 = $28;
 $29 = $18;
 $30 = HEAP32[$29>>2]|0;
 $31 = ($25|0)!=($30|0);
 if ($31) {
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator,$23,1);
  $17 = $23;
  $32 = $17;
  $33 = ((($32)) + 8|0);
  $16 = $33;
  $34 = $16;
  $15 = $34;
  $35 = $15;
  $36 = ((($23)) + 4|0);
  $37 = HEAP32[$36>>2]|0;
  $14 = $37;
  $38 = $14;
  $39 = $22;
  $10 = $35;
  $11 = $38;
  $12 = $39;
  $40 = $10;
  $41 = $11;
  $42 = $12;
  $9 = $42;
  $43 = $9;
  ;HEAP8[$8>>0]=HEAP8[$13>>0]|0;
  $5 = $40;
  $6 = $41;
  $7 = $43;
  $44 = $5;
  $45 = $6;
  $46 = $7;
  $4 = $46;
  $47 = $4;
  $1 = $44;
  $2 = $45;
  $3 = $47;
  $48 = $2;
  $49 = $3;
  $0 = $49;
  $50 = $0;
  $51 = HEAP32[$50>>2]|0;
  HEAP32[$48>>2] = $51;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator);
  $52 = ((($23)) + 4|0);
  $53 = HEAP32[$52>>2]|0;
  $54 = ((($53)) + 4|0);
  HEAP32[$52>>2] = $54;
  STACKTOP = sp;return;
 } else {
  $55 = $22;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE21__push_back_slow_pathIRKS2_EEvOT_($23,$55);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE6resizeEjRKS2_($this,$__sz,$__x) {
 $this = $this|0;
 $__sz = $__sz|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $8 = 0, $9 = 0, $__cs = 0, $__old_size$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp;
 $7 = sp + 88|0;
 $18 = $this;
 $19 = $__sz;
 $20 = $__x;
 $21 = $18;
 $17 = $21;
 $22 = $17;
 $23 = ((($22)) + 4|0);
 $24 = HEAP32[$23>>2]|0;
 $25 = HEAP32[$22>>2]|0;
 $26 = $24;
 $27 = $25;
 $28 = (($26) - ($27))|0;
 $29 = (($28|0) / 4)&-1;
 $__cs = $29;
 $30 = $__cs;
 $31 = $19;
 $32 = ($30>>>0)<($31>>>0);
 if ($32) {
  $33 = $19;
  $34 = $__cs;
  $35 = (($33) - ($34))|0;
  $36 = $20;
  __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE8__appendEjRKS2_($21,$35,$36);
  STACKTOP = sp;return;
 }
 $37 = $__cs;
 $38 = $19;
 $39 = ($37>>>0)>($38>>>0);
 if (!($39)) {
  STACKTOP = sp;return;
 }
 $40 = HEAP32[$21>>2]|0;
 $41 = $19;
 $42 = (($40) + ($41<<2)|0);
 $15 = $21;
 $16 = $42;
 $43 = $15;
 $14 = $43;
 $44 = $14;
 $45 = ((($44)) + 4|0);
 $46 = HEAP32[$45>>2]|0;
 $47 = HEAP32[$44>>2]|0;
 $48 = $46;
 $49 = $47;
 $50 = (($48) - ($49))|0;
 $51 = (($50|0) / 4)&-1;
 $__old_size$i = $51;
 $52 = $16;
 $12 = $43;
 $13 = $52;
 $53 = $12;
 while(1) {
  $54 = $13;
  $55 = ((($53)) + 4|0);
  $56 = HEAP32[$55>>2]|0;
  $57 = ($54|0)!=($56|0);
  if (!($57)) {
   break;
  }
  $11 = $53;
  $58 = $11;
  $59 = ((($58)) + 8|0);
  $10 = $59;
  $60 = $10;
  $9 = $60;
  $61 = $9;
  $62 = ((($53)) + 4|0);
  $63 = HEAP32[$62>>2]|0;
  $64 = ((($63)) + -4|0);
  HEAP32[$62>>2] = $64;
  $8 = $64;
  $65 = $8;
  $5 = $61;
  $6 = $65;
  $66 = $5;
  $67 = $6;
  ;HEAP8[$4>>0]=HEAP8[$7>>0]|0;
  $2 = $66;
  $3 = $67;
  $68 = $2;
  $69 = $3;
  $0 = $68;
  $1 = $69;
 }
 $70 = $__old_size$i;
 __THREW__ = 0;
 invoke_vii(108,($43|0),($70|0));
 $71 = __THREW__; __THREW__ = 0;
 $72 = $71&1;
 if ($72) {
  $73 = ___cxa_find_matching_catch(0|0)|0;
  $74 = tempRet0;
  ___clang_call_terminate($73);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal11NoBaseClass6verifyINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEPKvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = (__ZN10emscripten8internal14getLightTypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEPKvRKT_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEvPT_($ptr) {
 $ptr = $ptr|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ptr;
 $1 = $0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  STACKTOP = sp;return;
 }
 __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEED2Ev($1);
 __ZdlPv($1);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPKNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal12getSignatureIPKvJPNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2376|0);
}
function __ZN10emscripten8internal12getSignatureIvJPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2368|0);
}
function __ZN10emscripten8internal12operator_newINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJEEEPT_DpOT0_() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 24|0;
 $6 = sp + 8|0;
 $10 = (__Znwj(12)|0);
 $9 = $10;
 $11 = $9;
 $8 = $11;
 $12 = $8;
 $7 = $12;
 HEAP32[$12>>2] = 0;
 $13 = ((($12)) + 4|0);
 HEAP32[$13>>2] = 0;
 $14 = ((($12)) + 8|0);
 $5 = $14;
 HEAP32[$6>>2] = 0;
 $15 = $5;
 $4 = $6;
 $16 = $4;
 $17 = HEAP32[$16>>2]|0;
 $2 = $15;
 HEAP32[$3>>2] = $17;
 $18 = $2;
 $1 = $18;
 $0 = $3;
 $19 = $0;
 $20 = HEAP32[$19>>2]|0;
 HEAP32[$18>>2] = $20;
 STACKTOP = sp;return ($10|0);
}
function __ZN10emscripten8internal7InvokerIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJEE6invokeEPFS9_vE($fn) {
 $fn = $fn|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $fn;
 $1 = $0;
 $2 = (FUNCTION_TABLE_i[$1 & 255]()|0);
 $3 = (__ZN10emscripten8internal11BindingTypeIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE10toWireTypeES9_($2)|0);
 STACKTOP = sp;return ($3|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 1;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJPFS9_vEEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2352|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EvPS8_JSA_EE6invokeERKSC_SD_S5_($method,$wireThis,$args) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 8|0;
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $4 = $0;
 $$field = HEAP32[$4>>2]|0;
 $$index1 = ((($4)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $5 = $1;
 $6 = (__ZN10emscripten8internal11BindingTypeIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeES9_($5)|0);
 $7 = $$field2 >> 1;
 $8 = (($6) + ($7)|0);
 $9 = $$field2 & 1;
 $10 = ($9|0)!=(0);
 if ($10) {
  $11 = HEAP32[$8>>2]|0;
  $12 = (($11) + ($$field)|0);
  $13 = HEAP32[$12>>2]|0;
  $17 = $13;
 } else {
  $14 = $$field;
  $17 = $14;
 }
 $15 = $2;
 $16 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($15)|0);
 HEAP32[$3>>2] = $16;
 FUNCTION_TABLE_vii[$17 & 255]($8,$3);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEERKS8_EE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEERKS8_EE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEERKS7_EEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EPS8_S5_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2328|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EEEPT_RKSD_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EvPS8_JjSA_EE6invokeERKSC_SD_jS5_($method,$wireThis,$args,$args1) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 $args1 = $args1|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp + 12|0;
 $0 = $method;
 $1 = $wireThis;
 $2 = $args;
 $3 = $args1;
 $5 = $0;
 $$field = HEAP32[$5>>2]|0;
 $$index1 = ((($5)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $6 = $1;
 $7 = (__ZN10emscripten8internal11BindingTypeIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeES9_($6)|0);
 $8 = $$field2 >> 1;
 $9 = (($7) + ($8)|0);
 $10 = $$field2 & 1;
 $11 = ($10|0)!=(0);
 if ($11) {
  $12 = HEAP32[$9>>2]|0;
  $13 = (($12) + ($$field)|0);
  $14 = HEAP32[$13>>2]|0;
  $20 = $14;
 } else {
  $15 = $$field;
  $20 = $15;
 }
 $16 = $2;
 $17 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($16)|0);
 $18 = $3;
 $19 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($18)|0);
 HEAP32[$4>>2] = $19;
 FUNCTION_TABLE_viii[$20 & 255]($9,$17,$4);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEjRKS8_EE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEjRKS8_EE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEjRKS7_EEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIvJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EPS8_jS5_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2240|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EEEPT_RKSD_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE4sizeEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 $5 = $3;
 $6 = $4;
 $7 = (($5) - ($6))|0;
 $8 = (($7|0) / 4)&-1;
 STACKTOP = sp;return ($8|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEjPKS8_JEE6invokeERKSA_SC_($method,$wireThis) {
 $method = $method|0;
 $wireThis = $wireThis|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp + 4|0;
 $0 = $method;
 $1 = $wireThis;
 $3 = $0;
 $$field = HEAP32[$3>>2]|0;
 $$index1 = ((($3)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 $4 = $1;
 $5 = (__ZN10emscripten8internal11BindingTypeIPKNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeESA_($4)|0);
 $6 = $$field2 >> 1;
 $7 = (($5) + ($6)|0);
 $8 = $$field2 & 1;
 $9 = ($8|0)!=(0);
 if ($9) {
  $10 = HEAP32[$7>>2]|0;
  $11 = (($10) + ($$field)|0);
  $12 = HEAP32[$11>>2]|0;
  $14 = $12;
 } else {
  $13 = $$field;
  $14 = $13;
 }
 $15 = (FUNCTION_TABLE_ii[$14 & 255]($7)|0);
 HEAP32[$2>>2] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($2)|0);
 STACKTOP = sp;return ($16|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEEEEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIjJRKMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEPKS8_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2160|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEEEPT_RKSB_($t) {
 $t = $t|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $$field = HEAP32[$2>>2]|0;
 $$index1 = ((($2)) + 4|0);
 $$field2 = HEAP32[$$index1>>2]|0;
 HEAP32[$1>>2] = $$field;
 $$index5 = ((($1)) + 4|0);
 HEAP32[$$index5>>2] = $$field2;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12VectorAccessINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getERKS8_j($v,$index) {
 $v = $v|0;
 $index = $index|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 8|0;
 $4 = $v;
 $5 = $index;
 $6 = $5;
 $7 = $4;
 $2 = $7;
 $8 = $2;
 $9 = ((($8)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = HEAP32[$8>>2]|0;
 $12 = $10;
 $13 = $11;
 $14 = (($12) - ($13))|0;
 $15 = (($14|0) / 4)&-1;
 $16 = ($6>>>0)<($15>>>0);
 if ($16) {
  $17 = $4;
  $18 = $5;
  $0 = $17;
  $1 = $18;
  $19 = $0;
  $20 = $1;
  $21 = HEAP32[$19>>2]|0;
  $22 = (($21) + ($20<<2)|0);
  __ZN10emscripten3valC2IRKP4BillEEOT_($3,$22);
  $24 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($24|0);
 } else {
  $23 = (__ZN10emscripten3val9undefinedEv()|0);
  HEAP32[$3>>2] = $23;
  $24 = HEAP32[$3>>2]|0;
  STACKTOP = sp;return ($24|0);
 }
 return (0)|0;
}
function __ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjES2_SB_JjEE6invokeEPSD_PS9_j($function,$wireThis,$args) {
 $function = $function|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp + 8|0;
 $0 = $function;
 $1 = $wireThis;
 $2 = $args;
 $6 = $0;
 $7 = HEAP32[$6>>2]|0;
 $8 = $1;
 $9 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeEPS8_($8)|0);
 $10 = $2;
 $11 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($10)|0);
 $12 = (FUNCTION_TABLE_iii[$7 & 255]($9,$11)|0);
 HEAP32[$3>>2] = $12;
 __THREW__ = 0;
 $13 = (invoke_ii(129,($3|0))|0);
 $14 = __THREW__; __THREW__ = 0;
 $15 = $14&1;
 if ($15) {
  $16 = ___cxa_find_matching_catch()|0;
  $17 = tempRet0;
  $4 = $16;
  $5 = $17;
  __ZN10emscripten3valD2Ev($3);
  $18 = $4;
  $19 = $5;
  ___resumeException($18|0);
  // unreachable;
 } else {
  __ZN10emscripten3valD2Ev($3);
  STACKTOP = sp;return ($13|0);
 }
 return (0)|0;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjEEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIPNS0_7_EM_VALEJPPFNS_3valERKNSt3__16vectorIP4BillNS5_9allocatorIS8_EEEEjEPSB_jEEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2104|0);
}
function __ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjEEEPT_RKSE_($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(4)|0);
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 HEAP32[$1>>2] = $3;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12VectorAccessINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3setERS8_jRKS5_($v,$index,$value) {
 $v = $v|0;
 $index = $index|0;
 $value = $value|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = $v;
 $3 = $index;
 $4 = $value;
 $5 = $4;
 $6 = HEAP32[$5>>2]|0;
 $7 = $2;
 $8 = $3;
 $0 = $7;
 $1 = $8;
 $9 = $0;
 $10 = $1;
 $11 = HEAP32[$9>>2]|0;
 $12 = (($11) + ($10<<2)|0);
 HEAP32[$12>>2] = $6;
 STACKTOP = sp;return 1;
}
function __ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EbS9_JjSB_EE6invokeEPSD_PS8_jS5_($function,$wireThis,$args,$args1) {
 $function = $function|0;
 $wireThis = $wireThis|0;
 $args = $args|0;
 $args1 = $args1|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp + 12|0;
 $0 = $function;
 $1 = $wireThis;
 $2 = $args;
 $3 = $args1;
 $5 = $0;
 $6 = HEAP32[$5>>2]|0;
 $7 = $1;
 $8 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeEPS8_($7)|0);
 $9 = $2;
 $10 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($9)|0);
 $11 = $3;
 $12 = (__ZN10emscripten8internal11BindingTypeIP4BillE12fromWireTypeES3_($11)|0);
 HEAP32[$4>>2] = $12;
 $13 = (FUNCTION_TABLE_iiii[$6 & 127]($8,$10,$4)|0);
 $14 = (__ZN10emscripten8internal11BindingTypeIbE10toWireTypeEb($13)|0);
 STACKTOP = sp;return ($14|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjRKS7_EE8getCountEv($this) {
 $this = $this|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 STACKTOP = sp;return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjRKS7_EE8getTypesEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjRKS6_EEEE3getEv()|0);
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12getSignatureIbJPPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EPS8_jS5_EEEPKcPFT_DpT0_E($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return (2080|0);
}
function __ZN10emscripten8internal10getContextIPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EEEPT_RKSE_($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $1 = (__Znwj(4)|0);
 $2 = $0;
 $3 = HEAP32[$2>>2]|0;
 HEAP32[$1>>2] = $3;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjRKS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2088|0);
}
function __ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIbE10toWireTypeEb($b) {
 $b = $b|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $b&1;
 $0 = $1;
 $2 = $0;
 $3 = $2&1;
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEjEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2112|0);
}
function __ZN10emscripten8internal11BindingTypeINS_3valEE10toWireTypeERKS2_($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 __emval_incref(($2|0));
 $3 = $0;
 $4 = HEAP32[$3>>2]|0;
 STACKTOP = sp;return ($4|0);
}
function __ZN10emscripten3valD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 __THREW__ = 0;
 invoke_vi(130,($2|0));
 $3 = __THREW__; __THREW__ = 0;
 $4 = $3&1;
 if ($4) {
  $5 = ___cxa_find_matching_catch(0|0)|0;
  $6 = tempRet0;
  ___clang_call_terminate($5);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten3valC2IRKP4BillEEOT_($this,$value) {
 $this = $this|0;
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $argv = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $argv = sp;
 $1 = $this;
 $2 = $value;
 $3 = $1;
 $4 = $2;
 $0 = $4;
 $5 = $0;
 __ZN10emscripten8internal12WireTypePackIJRKP4BillEEC2ES5_($argv,$5);
 $6 = (__ZN10emscripten8internal6TypeIDIRKP4BillE3getEv()|0);
 $7 = (__ZNK10emscripten8internal12WireTypePackIJRKP4BillEEcvPKvEv($argv)|0);
 $8 = (__emval_take_value(($6|0),($7|0))|0);
 HEAP32[$3>>2] = $8;
 STACKTOP = sp;return;
}
function __ZN10emscripten3val9undefinedEv() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = sp;
 __ZN10emscripten3valC2EPNS_8internal7_EM_VALE($0,(1));
 $1 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten3valC2EPNS_8internal7_EM_VALE($this,$handle) {
 $this = $this|0;
 $handle = $handle|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $handle;
 $2 = $0;
 $3 = $1;
 HEAP32[$2>>2] = $3;
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal12WireTypePackIJRKP4BillEEC2ES5_($this,$args) {
 $this = $this|0;
 $args = $args|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cursor = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $cursor = sp + 24|0;
 $5 = $this;
 $6 = $args;
 $7 = $5;
 $4 = $7;
 $8 = $4;
 HEAP32[$cursor>>2] = $8;
 $9 = $6;
 $0 = $9;
 $10 = $0;
 $2 = $cursor;
 $3 = $10;
 $11 = $2;
 $12 = $3;
 $1 = $12;
 $13 = $1;
 $14 = HEAP32[$13>>2]|0;
 $15 = (__ZN10emscripten8internal11BindingTypeIP4BillE10toWireTypeES3_($14)|0);
 __ZN10emscripten8internal20writeGenericWireTypeI4BillEEvRPNS0_15GenericWireTypeEPT_($11,$15);
 $16 = $2;
 __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE($16);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDIRKP4BillE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIRKP4BillE3getEv()|0);
 return ($0|0);
}
function __ZNK10emscripten8internal12WireTypePackIJRKP4BillEEcvPKvEv($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $this;
 $2 = $1;
 $0 = $2;
 $3 = $0;
 STACKTOP = sp;return ($3|0);
}
function __ZN10emscripten8internal11LightTypeIDIRKP4BillE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (968|0);
}
function __ZN10emscripten8internal11BindingTypeIP4BillE10toWireTypeES3_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal20writeGenericWireTypeI4BillEEvRPNS0_15GenericWireTypeEPT_($cursor,$wt) {
 $cursor = $cursor|0;
 $wt = $wt|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $cursor;
 $1 = $wt;
 $2 = $1;
 $3 = $0;
 $4 = HEAP32[$3>>2]|0;
 HEAP32[$4>>2] = $2;
 $5 = $0;
 $6 = HEAP32[$5>>2]|0;
 $7 = ((($6)) + 8|0);
 HEAP32[$5>>2] = $7;
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $0;
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2168|0);
}
function __ZN10emscripten8internal11BindingTypeIPKNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeESA_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEjRKS7_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2248|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE12fromWireTypeES9_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEERKS7_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2336|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__16vectorIP4BillNS4_9allocatorIS7_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2360|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE10toWireTypeES9_($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $p;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal11LightTypeIDIPKNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2176|0);
}
function __ZN10emscripten8internal11LightTypeIDIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2264|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1656|0);
}
function __ZN10emscripten8internal14getLightTypeIDINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 STACKTOP = sp;return (1656|0);
}
function __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE8__appendEjRKS2_($this,$__n,$__x) {
 $this = $this|0;
 $__n = $__n|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
 var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
 var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
 var $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $__a = 0, $__a$i = 0, $__annotator$i = 0, $__cap$i = 0, $__ms$i = 0, $__v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $6 = sp;
 $9 = sp + 241|0;
 $17 = sp + 216|0;
 $18 = sp + 164|0;
 $31 = sp + 8|0;
 $36 = sp + 240|0;
 $__annotator$i = sp + 242|0;
 $__v = sp + 108|0;
 $47 = $this;
 $48 = $__n;
 $49 = $__x;
 $52 = $47;
 $46 = $52;
 $53 = $46;
 $54 = ((($53)) + 8|0);
 $45 = $54;
 $55 = $45;
 $44 = $55;
 $56 = $44;
 $57 = HEAP32[$56>>2]|0;
 $58 = ((($52)) + 4|0);
 $59 = HEAP32[$58>>2]|0;
 $60 = $57;
 $61 = $59;
 $62 = (($60) - ($61))|0;
 $63 = (($62|0) / 4)&-1;
 $64 = $48;
 $65 = ($63>>>0)>=($64>>>0);
 if ($65) {
  $66 = $48;
  $67 = $49;
  $41 = $52;
  $42 = $66;
  $43 = $67;
  $68 = $41;
  $40 = $68;
  $69 = $40;
  $70 = ((($69)) + 8|0);
  $39 = $70;
  $71 = $39;
  $38 = $71;
  $72 = $38;
  $__a$i = $72;
  while(1) {
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotatorC2ERKS5_j($__annotator$i,$68,1);
   $73 = $__a$i;
   $74 = ((($68)) + 4|0);
   $75 = HEAP32[$74>>2]|0;
   $37 = $75;
   $76 = $37;
   $77 = $43;
   $33 = $73;
   $34 = $76;
   $35 = $77;
   $78 = $33;
   $79 = $34;
   $80 = $35;
   $32 = $80;
   $81 = $32;
   ;HEAP8[$31>>0]=HEAP8[$36>>0]|0;
   $28 = $78;
   $29 = $79;
   $30 = $81;
   $82 = $28;
   $83 = $29;
   $84 = $30;
   $27 = $84;
   $85 = $27;
   $24 = $82;
   $25 = $83;
   $26 = $85;
   $86 = $25;
   $87 = $26;
   $23 = $87;
   $88 = $23;
   $89 = HEAP32[$88>>2]|0;
   HEAP32[$86>>2] = $89;
   $90 = ((($68)) + 4|0);
   $91 = HEAP32[$90>>2]|0;
   $92 = ((($91)) + 4|0);
   HEAP32[$90>>2] = $92;
   $93 = $42;
   $94 = (($93) + -1)|0;
   $42 = $94;
   __ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE24__RAII_IncreaseAnnotator6__doneEv($__annotator$i);
   $95 = $42;
   $96 = ($95>>>0)>(0);
   if (!($96)) {
    break;
   }
  }
  STACKTOP = sp;return;
 }
 $22 = $52;
 $97 = $22;
 $98 = ((($97)) + 8|0);
 $21 = $98;
 $99 = $21;
 $20 = $99;
 $100 = $20;
 $__a = $100;
 $19 = $52;
 $101 = $19;
 $102 = ((($101)) + 4|0);
 $103 = HEAP32[$102>>2]|0;
 $104 = HEAP32[$101>>2]|0;
 $105 = $103;
 $106 = $104;
 $107 = (($105) - ($106))|0;
 $108 = (($107|0) / 4)&-1;
 $109 = $48;
 $110 = (($108) + ($109))|0;
 $16 = $52;
 HEAP32[$17>>2] = $110;
 $111 = $16;
 $112 = (__ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE8max_sizeEv($111)|0);
 $__ms$i = $112;
 $113 = HEAP32[$17>>2]|0;
 $114 = $__ms$i;
 $115 = ($113>>>0)>($114>>>0);
 if ($115) {
  __ZNKSt3__120__vector_base_commonILb1EE20__throw_length_errorEv($111);
  // unreachable;
 }
 $14 = $111;
 $116 = $14;
 $13 = $116;
 $117 = $13;
 $12 = $117;
 $118 = $12;
 $119 = ((($118)) + 8|0);
 $11 = $119;
 $120 = $11;
 $10 = $120;
 $121 = $10;
 $122 = HEAP32[$121>>2]|0;
 $123 = HEAP32[$117>>2]|0;
 $124 = $122;
 $125 = $123;
 $126 = (($124) - ($125))|0;
 $127 = (($126|0) / 4)&-1;
 $__cap$i = $127;
 $128 = $__cap$i;
 $129 = $__ms$i;
 $130 = (($129>>>0) / 2)&-1;
 $131 = ($128>>>0)>=($130>>>0);
 if ($131) {
  $132 = $__ms$i;
  $15 = $132;
 } else {
  $133 = $__cap$i;
  $134 = $133<<1;
  HEAP32[$18>>2] = $134;
  $7 = $18;
  $8 = $17;
  $135 = $7;
  $136 = $8;
  ;HEAP8[$6>>0]=HEAP8[$9>>0]|0;
  $4 = $135;
  $5 = $136;
  $137 = $4;
  $138 = $5;
  $1 = $6;
  $2 = $137;
  $3 = $138;
  $139 = $2;
  $140 = HEAP32[$139>>2]|0;
  $141 = $3;
  $142 = HEAP32[$141>>2]|0;
  $143 = ($140>>>0)<($142>>>0);
  $144 = $5;
  $145 = $4;
  $146 = $143 ? $144 : $145;
  $147 = HEAP32[$146>>2]|0;
  $15 = $147;
 }
 $148 = $15;
 $0 = $52;
 $149 = $0;
 $150 = ((($149)) + 4|0);
 $151 = HEAP32[$150>>2]|0;
 $152 = HEAP32[$149>>2]|0;
 $153 = $151;
 $154 = $152;
 $155 = (($153) - ($154))|0;
 $156 = (($155|0) / 4)&-1;
 $157 = $__a;
 __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEEC2EjjS5_($__v,$148,$156,$157);
 $158 = $48;
 $159 = $49;
 __THREW__ = 0;
 invoke_viii(131,($__v|0),($158|0),($159|0));
 $160 = __THREW__; __THREW__ = 0;
 $161 = $160&1;
 if ($161) {
  $164 = ___cxa_find_matching_catch()|0;
  $165 = tempRet0;
  $50 = $164;
  $51 = $165;
  __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($__v);
  $166 = $50;
  $167 = $51;
  ___resumeException($166|0);
  // unreachable;
 }
 __THREW__ = 0;
 invoke_vii(125,($52|0),($__v|0));
 $162 = __THREW__; __THREW__ = 0;
 $163 = $162&1;
 if ($163) {
  $164 = ___cxa_find_matching_catch()|0;
  $165 = tempRet0;
  $50 = $164;
  $51 = $165;
  __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($__v);
  $166 = $50;
  $167 = $51;
  ___resumeException($166|0);
  // unreachable;
 }
 __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEED2Ev($__v);
 STACKTOP = sp;return;
}
function __ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEE18__construct_at_endEjRKS2_($this,$__n,$__x) {
 $this = $this|0;
 $__n = $__n|0;
 $__x = $__x|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $9 = sp;
 $14 = sp + 84|0;
 $18 = $this;
 $19 = $__n;
 $20 = $__x;
 $21 = $18;
 $17 = $21;
 $22 = $17;
 $23 = ((($22)) + 12|0);
 $16 = $23;
 $24 = $16;
 $15 = $24;
 $25 = $15;
 $26 = ((($25)) + 4|0);
 $27 = HEAP32[$26>>2]|0;
 $__a = $27;
 while(1) {
  $28 = $__a;
  $29 = ((($21)) + 8|0);
  $30 = HEAP32[$29>>2]|0;
  $0 = $30;
  $31 = $0;
  $32 = $20;
  $11 = $28;
  $12 = $31;
  $13 = $32;
  $33 = $11;
  $34 = $12;
  $35 = $13;
  $10 = $35;
  $36 = $10;
  ;HEAP8[$9>>0]=HEAP8[$14>>0]|0;
  $6 = $33;
  $7 = $34;
  $8 = $36;
  $37 = $6;
  $38 = $7;
  $39 = $8;
  $5 = $39;
  $40 = $5;
  $2 = $37;
  $3 = $38;
  $4 = $40;
  $41 = $3;
  $42 = $4;
  $1 = $42;
  $43 = $1;
  $44 = HEAP32[$43>>2]|0;
  HEAP32[$41>>2] = $44;
  $45 = ((($21)) + 8|0);
  $46 = HEAP32[$45>>2]|0;
  $47 = ((($46)) + 4|0);
  HEAP32[$45>>2] = $47;
  $48 = $19;
  $49 = (($48) + -1)|0;
  $19 = $49;
  $50 = $19;
  $51 = ($50>>>0)>(0);
  if (!($51)) {
   break;
  }
 }
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI4BillEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2392|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJ8BillTypeNS0_17AllowedRawPointerI4BillEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2480|0);
}
function __ZN10emscripten8internal15EnumBindingTypeI8BillTypeE10toWireTypeES2_($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI4BillEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2520|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI4BillEEOiS6_S6_S6_O8BillTypeONSt3__112basic_stringIcNS9_11char_traitsIcEENS9_9allocatorIcEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2544|0);
}
function __ZN10emscripten8internal11BindingTypeIO8BillTypeE12fromWireTypeES2_($wt) {
 $wt = $wt|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $wt;
 $1 = $0;
 $2 = (__ZN10emscripten8internal15EnumBindingTypeI8BillTypeE12fromWireTypeES2_($1)|0);
 STACKTOP = sp;return ($2|0);
}
function __ZN10emscripten8internal15EnumBindingTypeI8BillTypeE12fromWireTypeES2_($v) {
 $v = $v|0;
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $v;
 $1 = $0;
 STACKTOP = sp;return ($1|0);
}
function __ZN4BillC2Eiiii8BillTypeNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE($this,$p_year,$p_month,$p_day,$p_amount,$p_type,$p_comment) {
 $this = $this|0;
 $p_year = $p_year|0;
 $p_month = $p_month|0;
 $p_day = $p_day|0;
 $p_amount = $p_amount|0;
 $p_type = $p_type|0;
 $p_comment = $p_comment|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__a$i$i = 0, $__i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $7 = $this;
 $8 = $p_year;
 $9 = $p_month;
 $10 = $p_day;
 $11 = $p_amount;
 $12 = $p_type;
 $15 = $7;
 $16 = $8;
 HEAP32[$15>>2] = $16;
 $17 = ((($15)) + 4|0);
 $18 = $9;
 HEAP32[$17>>2] = $18;
 $19 = ((($15)) + 8|0);
 $20 = $10;
 HEAP32[$19>>2] = $20;
 $21 = ((($15)) + 12|0);
 $22 = $11;
 HEAP32[$21>>2] = $22;
 $23 = ((($15)) + 16|0);
 $24 = $12;
 HEAP32[$23>>2] = $24;
 $25 = ((($15)) + 20|0);
 $6 = $25;
 $26 = $6;
 $5 = $26;
 $27 = $5;
 $4 = $27;
 $28 = $4;
 $3 = $28;
 $2 = $26;
 $29 = $2;
 $1 = $29;
 $30 = $1;
 $0 = $30;
 $31 = $0;
 $__a$i$i = $31;
 $__i$i$i = 0;
 while(1) {
  $32 = $__i$i$i;
  $33 = ($32>>>0)<(3);
  if (!($33)) {
   break;
  }
  $34 = $__i$i$i;
  $35 = $__a$i$i;
  $36 = (($35) + ($34<<2)|0);
  HEAP32[$36>>2] = 0;
  $37 = $__i$i$i;
  $38 = (($37) + 1)|0;
  $__i$i$i = $38;
 }
 $39 = ((($15)) + 20|0);
 __THREW__ = 0;
 (invoke_iii(128,($39|0),($p_comment|0))|0);
 $40 = __THREW__; __THREW__ = 0;
 $41 = $40&1;
 if ($41) {
  $42 = ___cxa_find_matching_catch()|0;
  $43 = tempRet0;
  $13 = $42;
  $14 = $43;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($25);
  $44 = $13;
  $45 = $14;
  ___resumeException($44|0);
  // unreachable;
 } else {
  STACKTOP = sp;return;
 }
}
function __ZN10emscripten8internal11LightTypeIDIPK4BillE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2600|0);
}
function __ZN10emscripten8internal11LightTypeIDIP4BillE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (968|0);
}
function __ZN10emscripten8internal11LightTypeIDI4BillE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (992|0);
}
function __ZN4BillD2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = $0;
 $2 = ((($1)) + 20|0);
 __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal14getLightTypeIDI4BillEEPKvRKT_($value) {
 $value = $value|0;
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 STACKTOP = sp;return (992|0);
}
function __ZN10emscripten8internal6TypeIDI8BillTypeE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI8BillTypeE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDI8BillTypeE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2488|0);
}
function ___getTypeName($ti) {
 $ti = $ti|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $ti;
 $2 = $1;
 $0 = $2;
 $3 = $0;
 $4 = ((($3)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (___strdup($5)|0);
 STACKTOP = sp;return ($6|0);
}
function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $this;
 $1 = (__ZN10emscripten8internal6TypeIDIvE3getEv()|0);
 __embind_register_void(($1|0),(2624|0));
 $2 = (__ZN10emscripten8internal6TypeIDIbE3getEv()|0);
 __embind_register_bool(($2|0),(2632|0),1,1,0);
 __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc(2640);
 __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc(2648);
 __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc(2664);
 __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc(2680);
 __ZN12_GLOBAL__N_1L16register_integerItEEvPKc(2688);
 __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc(2704);
 __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc(2712);
 __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc(2728);
 __ZN12_GLOBAL__N_1L16register_integerImEEvPKc(2736);
 __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc(2752);
 __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc(2760);
 $3 = (__ZN10emscripten8internal6TypeIDINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
 __embind_register_std_string(($3|0),(2768|0));
 $4 = (__ZN10emscripten8internal6TypeIDINSt3__112basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
 __embind_register_std_string(($4|0),(2784|0));
 $5 = (__ZN10emscripten8internal6TypeIDINSt3__112basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
 __embind_register_std_wstring(($5|0),4,(2824|0));
 $6 = (__ZN10emscripten8internal6TypeIDINS_3valEE3getEv()|0);
 __embind_register_emval(($6|0),(2840|0));
 __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc(2856);
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(2888);
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(2928);
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(2968);
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(3000);
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(3040);
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(3072);
 __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc(3112);
 __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc(3144);
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(3184);
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(3216);
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(3256);
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(3296);
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(3336);
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(3376);
 __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc(3416);
 __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc(3448);
 __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc(3480);
 STACKTOP = sp;return;
}
function __GLOBAL__sub_I_bind_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init42();
 return;
}
function __ZN10emscripten8internal6TypeIDIvE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIvE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDIbE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIbE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIcE3getEv()|0);
 $2 = $0;
 $3 = -128 << 24 >> 24;
 $4 = 127 << 24 >> 24;
 __embind_register_integer(($1|0),($2|0),1,($3|0),($4|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIaE3getEv()|0);
 $2 = $0;
 $3 = -128 << 24 >> 24;
 $4 = 127 << 24 >> 24;
 __embind_register_integer(($1|0),($2|0),1,($3|0),($4|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIhE3getEv()|0);
 $2 = $0;
 $3 = 0;
 $4 = 255;
 __embind_register_integer(($1|0),($2|0),1,($3|0),($4|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIsE3getEv()|0);
 $2 = $0;
 $3 = -32768 << 16 >> 16;
 $4 = 32767 << 16 >> 16;
 __embind_register_integer(($1|0),($2|0),2,($3|0),($4|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerItEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDItE3getEv()|0);
 $2 = $0;
 $3 = 0;
 $4 = 65535;
 __embind_register_integer(($1|0),($2|0),2,($3|0),($4|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0);
 $2 = $0;
 __embind_register_integer(($1|0),($2|0),4,-2147483648,2147483647);
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0);
 $2 = $0;
 __embind_register_integer(($1|0),($2|0),4,0,-1);
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIlE3getEv()|0);
 $2 = $0;
 __embind_register_integer(($1|0),($2|0),4,-2147483648,2147483647);
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L16register_integerImEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDImE3getEv()|0);
 $2 = $0;
 __embind_register_integer(($1|0),($2|0),4,0,-1);
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $2 = $0;
 __embind_register_float(($1|0),($2|0),4);
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDIdE3getEv()|0);
 $2 = $0;
 __embind_register_float(($1|0),($2|0),8);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINSt3__112basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINSt3__112basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS_3valEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc($name) {
 $name = $name|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $name;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv()|0);
 $2 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv()|0);
 $3 = $0;
 __embind_register_memory_view(($1|0),($2|0),($3|0));
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3520|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3560|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 6;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3600|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3640|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3680|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3720|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3760|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3800|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3840|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3880|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3920|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (3960|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2128|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4000|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4088|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1112|0);
}
function __ZN10emscripten8internal6TypeIDIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIdE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4832|0);
}
function __ZN10emscripten8internal6TypeIDIfE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIfE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIfE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4816|0);
}
function __ZN10emscripten8internal6TypeIDImE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDImE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDImE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4800|0);
}
function __ZN10emscripten8internal6TypeIDIlE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIlE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIlE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4784|0);
}
function __ZN10emscripten8internal6TypeIDIjE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIjE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIjE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4768|0);
}
function __ZN10emscripten8internal6TypeIDIiE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIiE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIiE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4752|0);
}
function __ZN10emscripten8internal6TypeIDItE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDItE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDItE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4736|0);
}
function __ZN10emscripten8internal6TypeIDIsE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIsE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIsE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4720|0);
}
function __ZN10emscripten8internal6TypeIDIhE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIhE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIhE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4688|0);
}
function __ZN10emscripten8internal6TypeIDIaE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIaE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4704|0);
}
function __ZN10emscripten8internal6TypeIDIcE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIcE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIcE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4672|0);
}
function __ZN10emscripten8internal11LightTypeIDIbE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4656|0);
}
function __ZN10emscripten8internal11LightTypeIDIvE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4624|0);
}
function ___cxx_global_var_init42() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(4176);
 return;
}
function ___strdup($s) {
 $s = $s|0;
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_strlen(($s|0))|0);
 $1 = (($0) + 1)|0;
 $2 = (_malloc($1)|0);
 $3 = ($2|0)==(0|0);
 if ($3) {
  $$0 = 0;
  return ($$0|0);
 }
 _memcpy(($2|0),($s|0),($1|0))|0;
 $$0 = $2;
 return ($$0|0);
}
function _abort_message($format,$varargs) {
 $format = $format|0;
 $varargs = $varargs|0;
 var $0 = 0, $list = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $list = sp;
 HEAP32[$list>>2] = $varargs;
 $0 = HEAP32[_stderr>>2]|0;
 (_vfprintf(($0|0),($format|0),($list|0))|0);
 (_fputc(10,($0|0))|0);
 _abort();
 // unreachable;
}
function __ZNKSt3__120__vector_base_commonILb1EE20__throw_length_errorEv($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___assert_fail((5192|0),(5216|0),303,(5296|0));
 // unreachable;
}
function ___cxa_get_globals_fast() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = (_pthread_once((5328|0),(132|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  $2 = HEAP32[5320>>2]|0;
  $3 = (_pthread_getspecific(($2|0))|0);
  STACKTOP = sp;return ($3|0);
 } else {
  _abort_message(5336,$vararg_buffer);
  // unreachable;
 }
 return (0)|0;
}
function __Znwj($size) {
 $size = $size|0;
 var $$lcssa = 0, $$size = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($size|0)==(0);
 $$size = $0 ? 1 : $size;
 $1 = (_malloc($$size)|0);
 $2 = ($1|0)==(0|0);
 L1: do {
  if ($2) {
   while(1) {
    $3 = (__ZSt15get_new_handlerv()|0);
    $4 = ($3|0)==(0|0);
    if ($4) {
     break;
    }
    FUNCTION_TABLE_v[$3 & 255]();
    $5 = (_malloc($$size)|0);
    $6 = ($5|0)==(0|0);
    if (!($6)) {
     $$lcssa = $5;
     break L1;
    }
   }
   $7 = (___cxa_allocate_exception(4)|0);
   HEAP32[$7>>2] = (4200);
   ___cxa_throw(($7|0),(4232|0),(14|0));
   // unreachable;
  } else {
   $$lcssa = $1;
  }
 } while(0);
 return ($$lcssa|0);
}
function __ZdlPv($ptr) {
 $ptr = $ptr|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _free($ptr);
 return;
}
function __ZNSt9bad_allocD2Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt9bad_allocD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZNKSt9bad_alloc4whatEv($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (5392|0);
}
function __ZSt11__terminatePFvvE($func) {
 $func = $func|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 __THREW__ = 0;
 invoke_v($func|0);
 $0 = __THREW__; __THREW__ = 0;
 $1 = $0&1;
 if (!($1)) {
  __THREW__ = 0;
  invoke_vii(133,(5408|0),($vararg_buffer|0));
  $2 = __THREW__; __THREW__ = 0;
 }
 $3 = ___cxa_find_matching_catch(0|0)|0;
 $4 = tempRet0;
 (___cxa_begin_catch(($3|0))|0);
 __THREW__ = 0;
 invoke_vii(133,(5448|0),($vararg_buffer1|0));
 $5 = __THREW__; __THREW__ = 0;
 $6 = ___cxa_find_matching_catch(0|0)|0;
 $7 = tempRet0;
 __THREW__ = 0;
 invoke_v(134);
 $8 = __THREW__; __THREW__ = 0;
 $9 = $8&1;
 if ($9) {
  $10 = ___cxa_find_matching_catch(0|0)|0;
  $11 = tempRet0;
  ___clang_call_terminate($10);
  // unreachable;
 } else {
  ___clang_call_terminate($6);
  // unreachable;
 }
}
function __ZSt9terminatev() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __THREW__ = 0;
 $0 = (invoke_i(135)|0);
 $1 = __THREW__; __THREW__ = 0;
 $2 = $1&1;
 if ($2) {
  $21 = ___cxa_find_matching_catch(0|0)|0;
  $22 = tempRet0;
  ___clang_call_terminate($21);
  // unreachable;
 }
 $3 = ($0|0)==(0|0);
 if (!($3)) {
  $4 = HEAP32[$0>>2]|0;
  $5 = ($4|0)==(0|0);
  if (!($5)) {
   $6 = ((($4)) + 48|0);
   $7 = $6;
   $8 = $7;
   $9 = HEAP32[$8>>2]|0;
   $10 = (($7) + 4)|0;
   $11 = $10;
   $12 = HEAP32[$11>>2]|0;
   $13 = $9 & -256;
   $14 = ($13|0)==(1126902528);
   $15 = ($12|0)==(1129074247);
   $16 = $14 & $15;
   if ($16) {
    $17 = ((($4)) + 12|0);
    $18 = HEAP32[$17>>2]|0;
    __ZSt11__terminatePFvvE($18);
    // unreachable;
   }
  }
 }
 $19 = HEAP32[1046]|0;HEAP32[1046] = (($19+0)|0);
 $20 = $19;
 __ZSt11__terminatePFvvE($20);
 // unreachable;
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[4248>>2]|0;HEAP32[4248>>2] = (($0+0)|0);
 $1 = $0;
 return ($1|0);
}
function __ZNSt9exceptionD2Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt9type_infoD2Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZN10__cxxabiv116__enum_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZN10__cxxabiv119__pointer_type_infoD0Ev($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($this);
 return;
}
function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($this,$thrown_type,$0) {
 $this = $this|0;
 $thrown_type = $thrown_type|0;
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($this|0)==($thrown_type|0);
 return ($1|0);
}
function __ZNK10__cxxabiv116__enum_type_info9can_catchEPKNS_16__shim_type_infoERPv($this,$thrown_type,$0) {
 $this = $this|0;
 $thrown_type = $thrown_type|0;
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($this|0)==($thrown_type|0);
 return ($1|0);
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($this,$thrown_type,$adjustedPtr) {
 $this = $this|0;
 $thrown_type = $thrown_type|0;
 $adjustedPtr = $adjustedPtr|0;
 var $$0 = 0, $$1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $info = 0, dest = 0;
 var label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $info = sp;
 $0 = ($this|0)==($thrown_type|0);
 if ($0) {
  $$1 = 1;
 } else {
  $1 = ($thrown_type|0)==(0|0);
  if ($1) {
   $$1 = 0;
  } else {
   $2 = (___dynamic_cast($thrown_type,4344,4400,0)|0);
   $3 = ($2|0)==(0|0);
   if ($3) {
    $$1 = 0;
   } else {
    dest=$info; stop=dest+56|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
    HEAP32[$info>>2] = $2;
    $4 = ((($info)) + 8|0);
    HEAP32[$4>>2] = $this;
    $5 = ((($info)) + 12|0);
    HEAP32[$5>>2] = -1;
    $6 = ((($info)) + 48|0);
    HEAP32[$6>>2] = 1;
    $7 = HEAP32[$2>>2]|0;
    $8 = ((($7)) + 28|0);
    $9 = HEAP32[$8>>2]|0;
    $10 = HEAP32[$adjustedPtr>>2]|0;
    FUNCTION_TABLE_viiii[$9 & 127]($2,$info,$10,1);
    $11 = ((($info)) + 24|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ($12|0)==(1);
    if ($13) {
     $14 = ((($info)) + 16|0);
     $15 = HEAP32[$14>>2]|0;
     HEAP32[$adjustedPtr>>2] = $15;
     $$0 = 1;
    } else {
     $$0 = 0;
    }
    $$1 = $$0;
   }
  }
 }
 STACKTOP = sp;return ($$1|0);
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($this,$info,$adjustedPtr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $adjustedPtr = $adjustedPtr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 16|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 do {
  if ($2) {
   HEAP32[$0>>2] = $adjustedPtr;
   $3 = ((($info)) + 24|0);
   HEAP32[$3>>2] = $path_below;
   $4 = ((($info)) + 36|0);
   HEAP32[$4>>2] = 1;
  } else {
   $5 = ($1|0)==($adjustedPtr|0);
   if (!($5)) {
    $9 = ((($info)) + 36|0);
    $10 = HEAP32[$9>>2]|0;
    $11 = (($10) + 1)|0;
    HEAP32[$9>>2] = $11;
    $12 = ((($info)) + 24|0);
    HEAP32[$12>>2] = 2;
    $13 = ((($info)) + 54|0);
    HEAP8[$13>>0] = 1;
    break;
   }
   $6 = ((($info)) + 24|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = ($7|0)==(2);
   if ($8) {
    HEAP32[$6>>2] = $path_below;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this,$info,$adjustedPtr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $adjustedPtr = $adjustedPtr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 if ($2) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$info,$adjustedPtr,$path_below);
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this,$info,$adjustedPtr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $adjustedPtr = $adjustedPtr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 if ($2) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$info,$adjustedPtr,$path_below);
 } else {
  $3 = ((($this)) + 8|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = HEAP32[$4>>2]|0;
  $6 = ((($5)) + 28|0);
  $7 = HEAP32[$6>>2]|0;
  FUNCTION_TABLE_viiii[$7 & 127]($4,$info,$adjustedPtr,$path_below);
 }
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this,$info,$adjustedPtr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $adjustedPtr = $adjustedPtr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $offset_to_base$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($this)) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = $1 >> 8;
 $3 = $1 & 1;
 $4 = ($3|0)==(0);
 if ($4) {
  $offset_to_base$0 = $2;
 } else {
  $5 = HEAP32[$adjustedPtr>>2]|0;
  $6 = (($5) + ($2)|0);
  $7 = HEAP32[$6>>2]|0;
  $offset_to_base$0 = $7;
 }
 $8 = HEAP32[$this>>2]|0;
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($9)) + 28|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($adjustedPtr) + ($offset_to_base$0)|0);
 $13 = $1 & 2;
 $14 = ($13|0)!=(0);
 $15 = $14 ? $path_below : 2;
 FUNCTION_TABLE_viiii[$11 & 127]($8,$info,$12,$15);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($this,$info,$adjustedPtr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $adjustedPtr = $adjustedPtr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $p$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 L1: do {
  if ($2) {
   __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$info,$adjustedPtr,$path_below);
  } else {
   $3 = ((($this)) + 16|0);
   $4 = ((($this)) + 12|0);
   $5 = HEAP32[$4>>2]|0;
   $6 = (((($this)) + 16|0) + ($5<<3)|0);
   __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($3,$info,$adjustedPtr,$path_below);
   $7 = ($5|0)>(1);
   if ($7) {
    $8 = ((($this)) + 24|0);
    $9 = ((($info)) + 54|0);
    $p$0 = $8;
    while(1) {
     __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($p$0,$info,$adjustedPtr,$path_below);
     $10 = HEAP8[$9>>0]|0;
     $11 = ($10<<24>>24)==(0);
     if (!($11)) {
      break L1;
     }
     $12 = ((($p$0)) + 8|0);
     $13 = ($12>>>0)<($6>>>0);
     if ($13) {
      $p$0 = $12;
     } else {
      break;
     }
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($this,$thrown_type,$adjustedPtr) {
 $this = $this|0;
 $thrown_type = $thrown_type|0;
 $adjustedPtr = $adjustedPtr|0;
 var $$$i = 0, $$0 = 0, $$1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $info = 0, $or$cond = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $info = sp;
 $0 = HEAP32[$adjustedPtr>>2]|0;
 $1 = HEAP32[$0>>2]|0;
 HEAP32[$adjustedPtr>>2] = $1;
 $2 = ($this|0)==($thrown_type|0);
 $3 = ($thrown_type|0)==(4640|0);
 $$$i = $2 | $3;
 if ($$$i) {
  $$1 = 1;
 } else {
  $4 = ($thrown_type|0)==(0|0);
  if ($4) {
   $$1 = 0;
  } else {
   $5 = (___dynamic_cast($thrown_type,4344,4512,0)|0);
   $6 = ($5|0)==(0|0);
   if ($6) {
    $$1 = 0;
   } else {
    $7 = ((($5)) + 8|0);
    $8 = HEAP32[$7>>2]|0;
    $9 = ((($this)) + 8|0);
    $10 = HEAP32[$9>>2]|0;
    $11 = $10 ^ -1;
    $12 = $8 & $11;
    $13 = ($12|0)==(0);
    if ($13) {
     $14 = ((($this)) + 12|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ((($5)) + 12|0);
     $17 = HEAP32[$16>>2]|0;
     $18 = ($15|0)==($17|0);
     $19 = ($15|0)==(4624|0);
     $or$cond = $19 | $18;
     if ($or$cond) {
      $$1 = 1;
     } else {
      $20 = ($15|0)==(0|0);
      if ($20) {
       $$1 = 0;
      } else {
       $21 = (___dynamic_cast($15,4344,4400,0)|0);
       $22 = ($21|0)==(0|0);
       if ($22) {
        $$1 = 0;
       } else {
        $23 = HEAP32[$16>>2]|0;
        $24 = ($23|0)==(0|0);
        if ($24) {
         $$1 = 0;
        } else {
         $25 = (___dynamic_cast($23,4344,4400,0)|0);
         $26 = ($25|0)==(0|0);
         if ($26) {
          $$1 = 0;
         } else {
          dest=$info; stop=dest+56|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
          HEAP32[$info>>2] = $25;
          $27 = ((($info)) + 8|0);
          HEAP32[$27>>2] = $21;
          $28 = ((($info)) + 12|0);
          HEAP32[$28>>2] = -1;
          $29 = ((($info)) + 48|0);
          HEAP32[$29>>2] = 1;
          $30 = HEAP32[$25>>2]|0;
          $31 = ((($30)) + 28|0);
          $32 = HEAP32[$31>>2]|0;
          $33 = HEAP32[$adjustedPtr>>2]|0;
          FUNCTION_TABLE_viiii[$32 & 127]($25,$info,$33,1);
          $34 = ((($info)) + 24|0);
          $35 = HEAP32[$34>>2]|0;
          $36 = ($35|0)==(1);
          if ($36) {
           $37 = ((($info)) + 16|0);
           $38 = HEAP32[$37>>2]|0;
           HEAP32[$adjustedPtr>>2] = $38;
           $$0 = 1;
          } else {
           $$0 = 0;
          }
          $$1 = $$0;
         }
        }
       }
      }
     }
    } else {
     $$1 = 0;
    }
   }
  }
 }
 STACKTOP = sp;return ($$1|0);
}
function ___dynamic_cast($static_ptr,$static_type,$dst_type,$src2dst_offset) {
 $static_ptr = $static_ptr|0;
 $static_type = $static_type|0;
 $dst_type = $dst_type|0;
 $src2dst_offset = $src2dst_offset|0;
 var $$ = 0, $$8 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $dst_ptr$0 = 0, $info = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $info = sp;
 $0 = HEAP32[$static_ptr>>2]|0;
 $1 = ((($0)) + -8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = $2;
 $4 = (($static_ptr) + ($3)|0);
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 HEAP32[$info>>2] = $dst_type;
 $7 = ((($info)) + 4|0);
 HEAP32[$7>>2] = $static_ptr;
 $8 = ((($info)) + 8|0);
 HEAP32[$8>>2] = $static_type;
 $9 = ((($info)) + 12|0);
 HEAP32[$9>>2] = $src2dst_offset;
 $10 = ((($info)) + 16|0);
 $11 = ((($info)) + 20|0);
 $12 = ((($info)) + 24|0);
 $13 = ((($info)) + 28|0);
 $14 = ((($info)) + 32|0);
 $15 = ((($info)) + 40|0);
 $16 = ($6|0)==($dst_type|0);
 dest=$10; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$10+36>>1]=0|0;HEAP8[$10+38>>0]=0|0;
 do {
  if ($16) {
   $17 = ((($info)) + 48|0);
   HEAP32[$17>>2] = 1;
   $18 = HEAP32[$dst_type>>2]|0;
   $19 = ((($18)) + 20|0);
   $20 = HEAP32[$19>>2]|0;
   FUNCTION_TABLE_viiiiii[$20 & 63]($dst_type,$info,$4,$4,1,0);
   $21 = HEAP32[$12>>2]|0;
   $22 = ($21|0)==(1);
   $$ = $22 ? $4 : 0;
   $dst_ptr$0 = $$;
  } else {
   $23 = ((($info)) + 36|0);
   $24 = HEAP32[$6>>2]|0;
   $25 = ((($24)) + 24|0);
   $26 = HEAP32[$25>>2]|0;
   FUNCTION_TABLE_viiiii[$26 & 63]($6,$info,$4,1,0);
   $27 = HEAP32[$23>>2]|0;
   if ((($27|0) == 0)) {
    $28 = HEAP32[$15>>2]|0;
    $29 = ($28|0)==(1);
    $30 = HEAP32[$13>>2]|0;
    $31 = ($30|0)==(1);
    $or$cond = $29 & $31;
    $32 = HEAP32[$14>>2]|0;
    $33 = ($32|0)==(1);
    $or$cond3 = $or$cond & $33;
    $34 = HEAP32[$11>>2]|0;
    $$8 = $or$cond3 ? $34 : 0;
    $dst_ptr$0 = $$8;
    break;
   } else if (!((($27|0) == 1))) {
    $dst_ptr$0 = 0;
    break;
   }
   $35 = HEAP32[$12>>2]|0;
   $36 = ($35|0)==(1);
   if (!($36)) {
    $37 = HEAP32[$15>>2]|0;
    $38 = ($37|0)==(0);
    $39 = HEAP32[$13>>2]|0;
    $40 = ($39|0)==(1);
    $or$cond5 = $38 & $40;
    $41 = HEAP32[$14>>2]|0;
    $42 = ($41|0)==(1);
    $or$cond7 = $or$cond5 & $42;
    if (!($or$cond7)) {
     $dst_ptr$0 = 0;
     break;
    }
   }
   $43 = HEAP32[$10>>2]|0;
   $dst_ptr$0 = $43;
  }
 } while(0);
 STACKTOP = sp;return ($dst_ptr$0|0);
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($this,$info,$dst_ptr,$current_ptr,$path_below) {
 $this = $this|0;
 $info = $info|0;
 $dst_ptr = $dst_ptr|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 53|0);
 HEAP8[$0>>0] = 1;
 $1 = ((($info)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==($current_ptr|0);
 do {
  if ($3) {
   $4 = ((($info)) + 52|0);
   HEAP8[$4>>0] = 1;
   $5 = ((($info)) + 16|0);
   $6 = HEAP32[$5>>2]|0;
   $7 = ($6|0)==(0|0);
   if ($7) {
    HEAP32[$5>>2] = $dst_ptr;
    $8 = ((($info)) + 24|0);
    HEAP32[$8>>2] = $path_below;
    $9 = ((($info)) + 36|0);
    HEAP32[$9>>2] = 1;
    $10 = ((($info)) + 48|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ($11|0)==(1);
    $13 = ($path_below|0)==(1);
    $or$cond = $12 & $13;
    if (!($or$cond)) {
     break;
    }
    $14 = ((($info)) + 54|0);
    HEAP8[$14>>0] = 1;
    break;
   }
   $15 = ($6|0)==($dst_ptr|0);
   if (!($15)) {
    $25 = ((($info)) + 36|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = (($26) + 1)|0;
    HEAP32[$25>>2] = $27;
    $28 = ((($info)) + 54|0);
    HEAP8[$28>>0] = 1;
    break;
   }
   $16 = ((($info)) + 24|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ($17|0)==(2);
   if ($18) {
    HEAP32[$16>>2] = $path_below;
    $22 = $path_below;
   } else {
    $22 = $17;
   }
   $19 = ((($info)) + 48|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = ($20|0)==(1);
   $23 = ($22|0)==(1);
   $or$cond1 = $21 & $23;
   if ($or$cond1) {
    $24 = ((($info)) + 54|0);
    HEAP8[$24>>0] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this,$info,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $does_dst_type_point_to_our_static_type$0$off0$lcssa = 0, $does_dst_type_point_to_our_static_type$0$off023 = 0, $does_dst_type_point_to_our_static_type$1$off0 = 0, $is_dst_type_derived_from_static_type$0$off025 = 0, $is_dst_type_derived_from_static_type$1$off0 = 0, $is_dst_type_derived_from_static_type$2$off0 = 0;
 var $p$024 = 0, $p2$0 = 0, $p2$1 = 0, $p2$2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 L1: do {
  if ($2) {
   $3 = ((($info)) + 4|0);
   $4 = HEAP32[$3>>2]|0;
   $5 = ($4|0)==($current_ptr|0);
   if ($5) {
    $6 = ((($info)) + 28|0);
    $7 = HEAP32[$6>>2]|0;
    $8 = ($7|0)==(1);
    if (!($8)) {
     HEAP32[$6>>2] = $path_below;
    }
   }
  } else {
   $9 = HEAP32[$info>>2]|0;
   $10 = ($this|0)==($9|0);
   if (!($10)) {
    $57 = ((($this)) + 16|0);
    $58 = ((($this)) + 12|0);
    $59 = HEAP32[$58>>2]|0;
    $60 = (((($this)) + 16|0) + ($59<<3)|0);
    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($57,$info,$current_ptr,$path_below,$use_strcmp);
    $61 = ((($this)) + 24|0);
    $62 = ($59|0)>(1);
    if (!($62)) {
     break;
    }
    $63 = ((($this)) + 8|0);
    $64 = HEAP32[$63>>2]|0;
    $65 = $64 & 2;
    $66 = ($65|0)==(0);
    if ($66) {
     $67 = ((($info)) + 36|0);
     $68 = HEAP32[$67>>2]|0;
     $69 = ($68|0)==(1);
     if (!($69)) {
      $75 = $64 & 1;
      $76 = ($75|0)==(0);
      if ($76) {
       $79 = ((($info)) + 54|0);
       $p2$2 = $61;
       while(1) {
        $88 = HEAP8[$79>>0]|0;
        $89 = ($88<<24>>24)==(0);
        if (!($89)) {
         break L1;
        }
        $90 = HEAP32[$67>>2]|0;
        $91 = ($90|0)==(1);
        if ($91) {
         break L1;
        }
        __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($p2$2,$info,$current_ptr,$path_below,$use_strcmp);
        $92 = ((($p2$2)) + 8|0);
        $93 = ($92>>>0)<($60>>>0);
        if ($93) {
         $p2$2 = $92;
        } else {
         break L1;
        }
       }
      }
      $77 = ((($info)) + 24|0);
      $78 = ((($info)) + 54|0);
      $p2$1 = $61;
      while(1) {
       $80 = HEAP8[$78>>0]|0;
       $81 = ($80<<24>>24)==(0);
       if (!($81)) {
        break L1;
       }
       $82 = HEAP32[$67>>2]|0;
       $83 = ($82|0)==(1);
       if ($83) {
        $84 = HEAP32[$77>>2]|0;
        $85 = ($84|0)==(1);
        if ($85) {
         break L1;
        }
       }
       __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($p2$1,$info,$current_ptr,$path_below,$use_strcmp);
       $86 = ((($p2$1)) + 8|0);
       $87 = ($86>>>0)<($60>>>0);
       if ($87) {
        $p2$1 = $86;
       } else {
        break L1;
       }
      }
     }
    }
    $70 = ((($info)) + 54|0);
    $p2$0 = $61;
    while(1) {
     $71 = HEAP8[$70>>0]|0;
     $72 = ($71<<24>>24)==(0);
     if (!($72)) {
      break L1;
     }
     __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($p2$0,$info,$current_ptr,$path_below,$use_strcmp);
     $73 = ((($p2$0)) + 8|0);
     $74 = ($73>>>0)<($60>>>0);
     if ($74) {
      $p2$0 = $73;
     } else {
      break L1;
     }
    }
   }
   $11 = ((($info)) + 16|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = ($12|0)==($current_ptr|0);
   if (!($13)) {
    $14 = ((($info)) + 20|0);
    $15 = HEAP32[$14>>2]|0;
    $16 = ($15|0)==($current_ptr|0);
    if (!($16)) {
     $19 = ((($info)) + 32|0);
     HEAP32[$19>>2] = $path_below;
     $20 = ((($info)) + 44|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($21|0)==(4);
     if ($22) {
      break;
     }
     $23 = ((($this)) + 12|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = (((($this)) + 16|0) + ($24<<3)|0);
     $26 = ((($info)) + 52|0);
     $27 = ((($info)) + 53|0);
     $28 = ((($info)) + 54|0);
     $29 = ((($this)) + 8|0);
     $30 = ((($info)) + 24|0);
     $31 = ($24|0)>(0);
     L34: do {
      if ($31) {
       $32 = ((($this)) + 16|0);
       $does_dst_type_point_to_our_static_type$0$off023 = 0;$is_dst_type_derived_from_static_type$0$off025 = 0;$p$024 = $32;
       while(1) {
        HEAP8[$26>>0] = 0;
        HEAP8[$27>>0] = 0;
        __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($p$024,$info,$current_ptr,$current_ptr,1,$use_strcmp);
        $33 = HEAP8[$28>>0]|0;
        $34 = ($33<<24>>24)==(0);
        if (!($34)) {
         $does_dst_type_point_to_our_static_type$0$off0$lcssa = $does_dst_type_point_to_our_static_type$0$off023;$is_dst_type_derived_from_static_type$2$off0 = $is_dst_type_derived_from_static_type$0$off025;
         label = 20;
         break L34;
        }
        $35 = HEAP8[$27>>0]|0;
        $36 = ($35<<24>>24)==(0);
        do {
         if ($36) {
          $does_dst_type_point_to_our_static_type$1$off0 = $does_dst_type_point_to_our_static_type$0$off023;$is_dst_type_derived_from_static_type$1$off0 = $is_dst_type_derived_from_static_type$0$off025;
         } else {
          $37 = HEAP8[$26>>0]|0;
          $38 = ($37<<24>>24)==(0);
          if ($38) {
           $44 = HEAP32[$29>>2]|0;
           $45 = $44 & 1;
           $46 = ($45|0)==(0);
           if ($46) {
            $does_dst_type_point_to_our_static_type$0$off0$lcssa = $does_dst_type_point_to_our_static_type$0$off023;$is_dst_type_derived_from_static_type$2$off0 = 1;
            label = 20;
            break L34;
           } else {
            $does_dst_type_point_to_our_static_type$1$off0 = $does_dst_type_point_to_our_static_type$0$off023;$is_dst_type_derived_from_static_type$1$off0 = 1;
            break;
           }
          }
          $39 = HEAP32[$30>>2]|0;
          $40 = ($39|0)==(1);
          if ($40) {
           break L34;
          }
          $41 = HEAP32[$29>>2]|0;
          $42 = $41 & 2;
          $43 = ($42|0)==(0);
          if ($43) {
           break L34;
          } else {
           $does_dst_type_point_to_our_static_type$1$off0 = 1;$is_dst_type_derived_from_static_type$1$off0 = 1;
          }
         }
        } while(0);
        $47 = ((($p$024)) + 8|0);
        $48 = ($47>>>0)<($25>>>0);
        if ($48) {
         $does_dst_type_point_to_our_static_type$0$off023 = $does_dst_type_point_to_our_static_type$1$off0;$is_dst_type_derived_from_static_type$0$off025 = $is_dst_type_derived_from_static_type$1$off0;$p$024 = $47;
        } else {
         $does_dst_type_point_to_our_static_type$0$off0$lcssa = $does_dst_type_point_to_our_static_type$1$off0;$is_dst_type_derived_from_static_type$2$off0 = $is_dst_type_derived_from_static_type$1$off0;
         label = 20;
         break;
        }
       }
      } else {
       $does_dst_type_point_to_our_static_type$0$off0$lcssa = 0;$is_dst_type_derived_from_static_type$2$off0 = 0;
       label = 20;
      }
     } while(0);
     do {
      if ((label|0) == 20) {
       if ($does_dst_type_point_to_our_static_type$0$off0$lcssa) {
        label = 24;
       } else {
        HEAP32[$14>>2] = $current_ptr;
        $49 = ((($info)) + 40|0);
        $50 = HEAP32[$49>>2]|0;
        $51 = (($50) + 1)|0;
        HEAP32[$49>>2] = $51;
        $52 = ((($info)) + 36|0);
        $53 = HEAP32[$52>>2]|0;
        $54 = ($53|0)==(1);
        if ($54) {
         $55 = HEAP32[$30>>2]|0;
         $56 = ($55|0)==(2);
         if ($56) {
          HEAP8[$28>>0] = 1;
          if ($is_dst_type_derived_from_static_type$2$off0) {
           break;
          }
         } else {
          label = 24;
         }
        } else {
         label = 24;
        }
       }
       if ((label|0) == 24) {
        if ($is_dst_type_derived_from_static_type$2$off0) {
         break;
        }
       }
       HEAP32[$20>>2] = 4;
       break L1;
      }
     } while(0);
     HEAP32[$20>>2] = 3;
     break;
    }
   }
   $17 = ($path_below|0)==(1);
   if ($17) {
    $18 = ((($info)) + 32|0);
    HEAP32[$18>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $dst_ptr = $dst_ptr|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $offset_to_base$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($this)) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = $1 >> 8;
 $3 = $1 & 1;
 $4 = ($3|0)==(0);
 if ($4) {
  $offset_to_base$0 = $2;
 } else {
  $5 = HEAP32[$current_ptr>>2]|0;
  $6 = (($5) + ($2)|0);
  $7 = HEAP32[$6>>2]|0;
  $offset_to_base$0 = $7;
 }
 $8 = HEAP32[$this>>2]|0;
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($9)) + 20|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($current_ptr) + ($offset_to_base$0)|0);
 $13 = $1 & 2;
 $14 = ($13|0)!=(0);
 $15 = $14 ? $path_below : 2;
 FUNCTION_TABLE_viiiiii[$11 & 63]($8,$info,$dst_ptr,$12,$15,$use_strcmp);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this,$info,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $offset_to_base$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($this)) + 4|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = $1 >> 8;
 $3 = $1 & 1;
 $4 = ($3|0)==(0);
 if ($4) {
  $offset_to_base$0 = $2;
 } else {
  $5 = HEAP32[$current_ptr>>2]|0;
  $6 = (($5) + ($2)|0);
  $7 = HEAP32[$6>>2]|0;
  $offset_to_base$0 = $7;
 }
 $8 = HEAP32[$this>>2]|0;
 $9 = HEAP32[$8>>2]|0;
 $10 = ((($9)) + 24|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = (($current_ptr) + ($offset_to_base$0)|0);
 $13 = $1 & 2;
 $14 = ($13|0)!=(0);
 $15 = $14 ? $path_below : 2;
 FUNCTION_TABLE_viiiii[$11 & 63]($8,$info,$12,$15,$use_strcmp);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this,$info,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $is_dst_type_derived_from_static_type$0$off01 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 L1: do {
  if ($2) {
   $3 = ((($info)) + 4|0);
   $4 = HEAP32[$3>>2]|0;
   $5 = ($4|0)==($current_ptr|0);
   if ($5) {
    $6 = ((($info)) + 28|0);
    $7 = HEAP32[$6>>2]|0;
    $8 = ($7|0)==(1);
    if (!($8)) {
     HEAP32[$6>>2] = $path_below;
    }
   }
  } else {
   $9 = HEAP32[$info>>2]|0;
   $10 = ($this|0)==($9|0);
   if (!($10)) {
    $43 = ((($this)) + 8|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = HEAP32[$44>>2]|0;
    $46 = ((($45)) + 24|0);
    $47 = HEAP32[$46>>2]|0;
    FUNCTION_TABLE_viiiii[$47 & 63]($44,$info,$current_ptr,$path_below,$use_strcmp);
    break;
   }
   $11 = ((($info)) + 16|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = ($12|0)==($current_ptr|0);
   if (!($13)) {
    $14 = ((($info)) + 20|0);
    $15 = HEAP32[$14>>2]|0;
    $16 = ($15|0)==($current_ptr|0);
    if (!($16)) {
     $19 = ((($info)) + 32|0);
     HEAP32[$19>>2] = $path_below;
     $20 = ((($info)) + 44|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($21|0)==(4);
     if ($22) {
      break;
     }
     $23 = ((($info)) + 52|0);
     HEAP8[$23>>0] = 0;
     $24 = ((($info)) + 53|0);
     HEAP8[$24>>0] = 0;
     $25 = ((($this)) + 8|0);
     $26 = HEAP32[$25>>2]|0;
     $27 = HEAP32[$26>>2]|0;
     $28 = ((($27)) + 20|0);
     $29 = HEAP32[$28>>2]|0;
     FUNCTION_TABLE_viiiiii[$29 & 63]($26,$info,$current_ptr,$current_ptr,1,$use_strcmp);
     $30 = HEAP8[$24>>0]|0;
     $31 = ($30<<24>>24)==(0);
     if ($31) {
      $is_dst_type_derived_from_static_type$0$off01 = 0;
      label = 13;
     } else {
      $32 = HEAP8[$23>>0]|0;
      $not$ = ($32<<24>>24)==(0);
      if ($not$) {
       $is_dst_type_derived_from_static_type$0$off01 = 1;
       label = 13;
      }
     }
     do {
      if ((label|0) == 13) {
       HEAP32[$14>>2] = $current_ptr;
       $33 = ((($info)) + 40|0);
       $34 = HEAP32[$33>>2]|0;
       $35 = (($34) + 1)|0;
       HEAP32[$33>>2] = $35;
       $36 = ((($info)) + 36|0);
       $37 = HEAP32[$36>>2]|0;
       $38 = ($37|0)==(1);
       if ($38) {
        $39 = ((($info)) + 24|0);
        $40 = HEAP32[$39>>2]|0;
        $41 = ($40|0)==(2);
        if ($41) {
         $42 = ((($info)) + 54|0);
         HEAP8[$42>>0] = 1;
         if ($is_dst_type_derived_from_static_type$0$off01) {
          break;
         }
        } else {
         label = 16;
        }
       } else {
        label = 16;
       }
       if ((label|0) == 16) {
        if ($is_dst_type_derived_from_static_type$0$off01) {
         break;
        }
       }
       HEAP32[$20>>2] = 4;
       break L1;
      }
     } while(0);
     HEAP32[$20>>2] = 3;
     break;
    }
   }
   $17 = ($path_below|0)==(1);
   if ($17) {
    $18 = ((($info)) + 32|0);
    HEAP32[$18>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($this,$info,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 do {
  if ($2) {
   $3 = ((($info)) + 4|0);
   $4 = HEAP32[$3>>2]|0;
   $5 = ($4|0)==($current_ptr|0);
   if ($5) {
    $6 = ((($info)) + 28|0);
    $7 = HEAP32[$6>>2]|0;
    $8 = ($7|0)==(1);
    if (!($8)) {
     HEAP32[$6>>2] = $path_below;
    }
   }
  } else {
   $9 = HEAP32[$info>>2]|0;
   $10 = ($this|0)==($9|0);
   if ($10) {
    $11 = ((($info)) + 16|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ($12|0)==($current_ptr|0);
    if (!($13)) {
     $14 = ((($info)) + 20|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)==($current_ptr|0);
     if (!($16)) {
      $19 = ((($info)) + 32|0);
      HEAP32[$19>>2] = $path_below;
      HEAP32[$14>>2] = $current_ptr;
      $20 = ((($info)) + 40|0);
      $21 = HEAP32[$20>>2]|0;
      $22 = (($21) + 1)|0;
      HEAP32[$20>>2] = $22;
      $23 = ((($info)) + 36|0);
      $24 = HEAP32[$23>>2]|0;
      $25 = ($24|0)==(1);
      if ($25) {
       $26 = ((($info)) + 24|0);
       $27 = HEAP32[$26>>2]|0;
       $28 = ($27|0)==(2);
       if ($28) {
        $29 = ((($info)) + 54|0);
        HEAP8[$29>>0] = 1;
       }
      }
      $30 = ((($info)) + 44|0);
      HEAP32[$30>>2] = 4;
      break;
     }
    }
    $17 = ($path_below|0)==(1);
    if ($17) {
     $18 = ((($info)) + 32|0);
     HEAP32[$18>>2] = 1;
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $dst_ptr = $dst_ptr|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $p$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 if ($2) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$info,$dst_ptr,$current_ptr,$path_below);
 } else {
  $3 = ((($info)) + 52|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = ((($info)) + 53|0);
  $6 = HEAP8[$5>>0]|0;
  $7 = ((($this)) + 16|0);
  $8 = ((($this)) + 12|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = (((($this)) + 16|0) + ($9<<3)|0);
  HEAP8[$3>>0] = 0;
  HEAP8[$5>>0] = 0;
  __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($7,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp);
  $11 = ($9|0)>(1);
  L4: do {
   if ($11) {
    $12 = ((($this)) + 24|0);
    $13 = ((($info)) + 24|0);
    $14 = ((($this)) + 8|0);
    $15 = ((($info)) + 54|0);
    $p$0 = $12;
    while(1) {
     $16 = HEAP8[$15>>0]|0;
     $17 = ($16<<24>>24)==(0);
     if (!($17)) {
      break L4;
     }
     $18 = HEAP8[$3>>0]|0;
     $19 = ($18<<24>>24)==(0);
     if ($19) {
      $25 = HEAP8[$5>>0]|0;
      $26 = ($25<<24>>24)==(0);
      if (!($26)) {
       $27 = HEAP32[$14>>2]|0;
       $28 = $27 & 1;
       $29 = ($28|0)==(0);
       if ($29) {
        break L4;
       }
      }
     } else {
      $20 = HEAP32[$13>>2]|0;
      $21 = ($20|0)==(1);
      if ($21) {
       break L4;
      }
      $22 = HEAP32[$14>>2]|0;
      $23 = $22 & 2;
      $24 = ($23|0)==(0);
      if ($24) {
       break L4;
      }
     }
     HEAP8[$3>>0] = 0;
     HEAP8[$5>>0] = 0;
     __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($p$0,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp);
     $30 = ((($p$0)) + 8|0);
     $31 = ($30>>>0)<($10>>>0);
     if ($31) {
      $p$0 = $30;
     } else {
      break;
     }
    }
   }
  } while(0);
  HEAP8[$3>>0] = $4;
  HEAP8[$5>>0] = $6;
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $dst_ptr = $dst_ptr|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 if ($2) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$info,$dst_ptr,$current_ptr,$path_below);
 } else {
  $3 = ((($this)) + 8|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = HEAP32[$4>>2]|0;
  $6 = ((($5)) + 20|0);
  $7 = HEAP32[$6>>2]|0;
  FUNCTION_TABLE_viiiiii[$7 & 63]($4,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($this,$info,$dst_ptr,$current_ptr,$path_below,$use_strcmp) {
 $this = $this|0;
 $info = $info|0;
 $dst_ptr = $dst_ptr|0;
 $current_ptr = $current_ptr|0;
 $path_below = $path_below|0;
 $use_strcmp = $use_strcmp|0;
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ((($info)) + 8|0);
 $1 = HEAP32[$0>>2]|0;
 $2 = ($this|0)==($1|0);
 if ($2) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$info,$dst_ptr,$current_ptr,$path_below);
 }
 return;
}
function ___cxa_can_catch($catchType,$excpType,$thrown) {
 $catchType = $catchType|0;
 $excpType = $excpType|0;
 $thrown = $thrown|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $temp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $temp = sp;
 $0 = HEAP32[$thrown>>2]|0;
 HEAP32[$temp>>2] = $0;
 $1 = HEAP32[$catchType>>2]|0;
 $2 = ((($1)) + 16|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (FUNCTION_TABLE_iiii[$3 & 127]($catchType,$excpType,$temp)|0);
 $5 = $4&1;
 if ($4) {
  $6 = HEAP32[$temp>>2]|0;
  HEAP32[$thrown>>2] = $6;
 }
 STACKTOP = sp;return ($5|0);
}
function ___cxa_is_pointer_type($type) {
 $type = $type|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($type|0)==(0|0);
 if ($0) {
  $3 = 0;
 } else {
  $1 = (___dynamic_cast($type,4344,4512,0)|0);
  $phitmp = ($1|0)!=(0|0);
  $3 = $phitmp;
 }
 $2 = $3&1;
 return ($2|0);
}
function __ZL25default_terminate_handlerv() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $thrown_object = 0, $vararg_buffer = 0, $vararg_buffer10 = 0;
 var $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp;
 $vararg_buffer3 = sp + 8|0;
 $vararg_buffer = sp + 16|0;
 $thrown_object = sp + 36|0;
 $0 = (___cxa_get_globals_fast()|0);
 $1 = ($0|0)==(0|0);
 if (!($1)) {
  $2 = HEAP32[$0>>2]|0;
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   $4 = ((($2)) + 80|0);
   $5 = ((($2)) + 48|0);
   $6 = $5;
   $7 = $6;
   $8 = HEAP32[$7>>2]|0;
   $9 = (($6) + 4)|0;
   $10 = $9;
   $11 = HEAP32[$10>>2]|0;
   $12 = $8 & -256;
   $13 = ($12|0)==(1126902528);
   $14 = ($11|0)==(1129074247);
   $15 = $13 & $14;
   if (!($15)) {
    $36 = HEAP32[5728>>2]|0;
    HEAP32[$vararg_buffer7>>2] = $36;
    _abort_message(5832,$vararg_buffer7);
    // unreachable;
   }
   $16 = ($8|0)==(1126902529);
   $17 = ($11|0)==(1129074247);
   $18 = $16 & $17;
   if ($18) {
    $19 = ((($2)) + 44|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = $20;
   } else {
    $21 = $4;
   }
   HEAP32[$thrown_object>>2] = $21;
   $22 = HEAP32[$2>>2]|0;
   $23 = ((($22)) + 4|0);
   $24 = HEAP32[$23>>2]|0;
   $25 = HEAP32[4272>>2]|0;
   $26 = ((($25)) + 16|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = (FUNCTION_TABLE_iiii[$27 & 127](4272,$22,$thrown_object)|0);
   if ($28) {
    $29 = HEAP32[$thrown_object>>2]|0;
    $30 = HEAP32[5728>>2]|0;
    $31 = HEAP32[$29>>2]|0;
    $32 = ((($31)) + 8|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (FUNCTION_TABLE_ii[$33 & 255]($29)|0);
    HEAP32[$vararg_buffer>>2] = $30;
    $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr1>>2] = $24;
    $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr2>>2] = $34;
    _abort_message(5736,$vararg_buffer);
    // unreachable;
   } else {
    $35 = HEAP32[5728>>2]|0;
    HEAP32[$vararg_buffer3>>2] = $35;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $24;
    _abort_message(5784,$vararg_buffer3);
    // unreachable;
   }
  }
 }
 _abort_message(5872,$vararg_buffer10);
 // unreachable;
}
function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 var $0 = 0, $1 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 $0 = (_pthread_key_create((5320|0),(136|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  STACKTOP = sp;return;
 } else {
  _abort_message(5504,$vararg_buffer);
  // unreachable;
 }
}
function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($p) {
 $p = $p|0;
 var $0 = 0, $1 = 0, $2 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $vararg_buffer = sp;
 _free($p);
 $0 = HEAP32[5320>>2]|0;
 $1 = (_pthread_setspecific(($0|0),(0|0))|0);
 $2 = ($1|0)==(0);
 if ($2) {
  STACKTOP = sp;return;
 } else {
  _abort_message(5560,$vararg_buffer);
  // unreachable;
 }
}
function __ZNKSt3__121__basic_string_commonILb1EE20__throw_length_errorEv($this) {
 $this = $this|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___assert_fail((5616|0),(5648|0),1164,(5296|0));
 // unreachable;
}
function _srand($s) {
 $s = $s|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (($s) + -1)|0;
 $1 = 5904;
 $2 = $1;
 HEAP32[$2>>2] = $0;
 $3 = (($1) + 4)|0;
 $4 = $3;
 HEAP32[$4>>2] = 0;
 return;
}
function _rand() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = 5904;
 $1 = $0;
 $2 = HEAP32[$1>>2]|0;
 $3 = (($0) + 4)|0;
 $4 = $3;
 $5 = HEAP32[$4>>2]|0;
 $6 = (___muldi3(($2|0),($5|0),1284865837,1481765933)|0);
 $7 = tempRet0;
 $8 = (_i64Add(($6|0),($7|0),1,0)|0);
 $9 = tempRet0;
 $10 = 5904;
 $11 = $10;
 HEAP32[$11>>2] = $8;
 $12 = (($10) + 4)|0;
 $13 = $12;
 HEAP32[$13>>2] = $9;
 $14 = (_bitshift64Lshr(($8|0),($9|0),33)|0);
 $15 = tempRet0;
 return ($14|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$3$i = 0, $$lcssa = 0, $$lcssa211 = 0, $$lcssa215 = 0, $$lcssa216 = 0, $$lcssa217 = 0, $$lcssa219 = 0, $$lcssa222 = 0, $$lcssa224 = 0, $$lcssa226 = 0, $$lcssa228 = 0, $$lcssa230 = 0, $$lcssa232 = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i22$i = 0, $$pre$i25 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i23$iZ2D = 0;
 var $$pre$phi$i26Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi58$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre105 = 0, $$pre106 = 0, $$pre14$i$i = 0, $$pre43$i = 0, $$pre56$i$i = 0, $$pre57$i$i = 0, $$pre8$i = 0, $$rsize$0$i = 0, $$rsize$3$i = 0, $$sum = 0, $$sum$i$i = 0, $$sum$i$i$i = 0, $$sum$i13$i = 0, $$sum$i14$i = 0, $$sum$i17$i = 0, $$sum$i19$i = 0;
 var $$sum$i2334 = 0, $$sum$i32 = 0, $$sum$i35 = 0, $$sum1 = 0, $$sum1$i = 0, $$sum1$i$i = 0, $$sum1$i15$i = 0, $$sum1$i20$i = 0, $$sum1$i24 = 0, $$sum10 = 0, $$sum10$i = 0, $$sum10$i$i = 0, $$sum11$i = 0, $$sum11$i$i = 0, $$sum1112 = 0, $$sum112$i = 0, $$sum113$i = 0, $$sum114$i = 0, $$sum115$i = 0, $$sum116$i = 0;
 var $$sum117$i = 0, $$sum118$i = 0, $$sum119$i = 0, $$sum12$i = 0, $$sum12$i$i = 0, $$sum120$i = 0, $$sum121$i = 0, $$sum122$i = 0, $$sum123$i = 0, $$sum124$i = 0, $$sum125$i = 0, $$sum13$i = 0, $$sum13$i$i = 0, $$sum14$i$i = 0, $$sum15$i = 0, $$sum15$i$i = 0, $$sum16$i = 0, $$sum16$i$i = 0, $$sum17$i = 0, $$sum17$i$i = 0;
 var $$sum18$i = 0, $$sum1819$i$i = 0, $$sum2 = 0, $$sum2$i = 0, $$sum2$i$i = 0, $$sum2$i$i$i = 0, $$sum2$i16$i = 0, $$sum2$i18$i = 0, $$sum2$i21$i = 0, $$sum20$i$i = 0, $$sum21$i$i = 0, $$sum22$i$i = 0, $$sum23$i$i = 0, $$sum24$i$i = 0, $$sum25$i$i = 0, $$sum27$i$i = 0, $$sum28$i$i = 0, $$sum29$i$i = 0, $$sum3$i = 0, $$sum3$i27 = 0;
 var $$sum30$i$i = 0, $$sum3132$i$i = 0, $$sum34$i$i = 0, $$sum3536$i$i = 0, $$sum3738$i$i = 0, $$sum39$i$i = 0, $$sum4 = 0, $$sum4$i = 0, $$sum4$i$i = 0, $$sum4$i28 = 0, $$sum40$i$i = 0, $$sum41$i$i = 0, $$sum42$i$i = 0, $$sum5$i = 0, $$sum5$i$i = 0, $$sum56 = 0, $$sum6$i = 0, $$sum67$i$i = 0, $$sum7$i = 0, $$sum8$i = 0;
 var $$sum9 = 0, $$sum9$i = 0, $$sum9$i$i = 0, $$tsize$1$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0;
 var $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0;
 var $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0;
 var $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0;
 var $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0;
 var $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0;
 var $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0;
 var $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0;
 var $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0;
 var $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0;
 var $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0;
 var $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0;
 var $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0;
 var $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0;
 var $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0;
 var $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0;
 var $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0;
 var $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0;
 var $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0;
 var $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0;
 var $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0;
 var $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0;
 var $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0;
 var $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0;
 var $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0;
 var $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0;
 var $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0;
 var $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0;
 var $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0;
 var $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0;
 var $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0;
 var $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0;
 var $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0;
 var $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0;
 var $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0;
 var $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0;
 var $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0;
 var $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0;
 var $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0;
 var $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0;
 var $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0;
 var $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0;
 var $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0;
 var $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0;
 var $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0;
 var $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0;
 var $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0;
 var $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0;
 var $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0;
 var $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0;
 var $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0, $K12$029$i = 0, $K2$07$i$i = 0, $K8$051$i$i = 0, $R$0$i = 0, $R$0$i$i = 0, $R$0$i$i$lcssa = 0, $R$0$i$lcssa = 0, $R$0$i18 = 0, $R$0$i18$lcssa = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i20 = 0, $RP$0$i = 0, $RP$0$i$i = 0, $RP$0$i$i$lcssa = 0, $RP$0$i$lcssa = 0;
 var $RP$0$i17 = 0, $RP$0$i17$lcssa = 0, $T$0$lcssa$i = 0, $T$0$lcssa$i$i = 0, $T$0$lcssa$i25$i = 0, $T$028$i = 0, $T$028$i$lcssa = 0, $T$050$i$i = 0, $T$050$i$i$lcssa = 0, $T$06$i$i = 0, $T$06$i$i$lcssa = 0, $br$0$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i21 = 0, $exitcond$i$i = 0, $i$02$i$i = 0, $idx$0$i = 0, $mem$0 = 0, $nb$0 = 0;
 var $not$$i = 0, $not$$i$i = 0, $not$$i26$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0, $or$cond$i30 = 0, $or$cond1$i = 0, $or$cond19$i = 0, $or$cond2$i = 0, $or$cond3$i = 0, $or$cond5$i = 0, $or$cond57$i = 0, $or$cond6$i = 0, $or$cond8$i = 0, $or$cond9$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i15 = 0, $rsize$1$i = 0;
 var $rsize$2$i = 0, $rsize$3$lcssa$i = 0, $rsize$331$i = 0, $rst$0$i = 0, $rst$1$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$084$i = 0, $sp$084$i$lcssa = 0, $sp$183$i = 0, $sp$183$i$lcssa = 0, $ssize$0$$i = 0, $ssize$0$i = 0, $ssize$1$ph$i = 0, $ssize$2$i = 0, $t$0$i = 0, $t$0$i14 = 0, $t$1$i = 0, $t$2$ph$i = 0;
 var $t$2$v$3$i = 0, $t$230$i = 0, $tbase$255$i = 0, $tsize$0$ph$i = 0, $tsize$0323944$i = 0, $tsize$1$i = 0, $tsize$254$i = 0, $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i16 = 0, $v$1$i = 0, $v$2$i = 0, $v$3$lcssa$i = 0, $v$3$ph$i = 0, $v$332$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   $2 = (($bytes) + 11)|0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[5912>>2]|0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($5))|0;
    $13 = $12 << 1;
    $14 = (5952 + ($13<<2)|0);
    $$sum10 = (($13) + 2)|0;
    $15 = (5952 + ($$sum10<<2)|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[5912>>2] = $22;
     } else {
      $23 = HEAP32[(5928)>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = ((($18)) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = ((($16)) + 4|0);
    HEAP32[$30>>2] = $29;
    $$sum1112 = $28 | 4;
    $31 = (($16) + ($$sum1112)|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = $32 | 1;
    HEAP32[$31>>2] = $33;
    $mem$0 = $17;
    return ($mem$0|0);
   }
   $34 = HEAP32[(5920)>>2]|0;
   $35 = ($4>>>0)>($34>>>0);
   if ($35) {
    $36 = ($7|0)==(0);
    if (!($36)) {
     $37 = $7 << $5;
     $38 = 2 << $5;
     $39 = (0 - ($38))|0;
     $40 = $38 | $39;
     $41 = $37 & $40;
     $42 = (0 - ($41))|0;
     $43 = $41 & $42;
     $44 = (($43) + -1)|0;
     $45 = $44 >>> 12;
     $46 = $45 & 16;
     $47 = $44 >>> $46;
     $48 = $47 >>> 5;
     $49 = $48 & 8;
     $50 = $49 | $46;
     $51 = $47 >>> $49;
     $52 = $51 >>> 2;
     $53 = $52 & 4;
     $54 = $50 | $53;
     $55 = $51 >>> $53;
     $56 = $55 >>> 1;
     $57 = $56 & 2;
     $58 = $54 | $57;
     $59 = $55 >>> $57;
     $60 = $59 >>> 1;
     $61 = $60 & 1;
     $62 = $58 | $61;
     $63 = $59 >>> $61;
     $64 = (($62) + ($63))|0;
     $65 = $64 << 1;
     $66 = (5952 + ($65<<2)|0);
     $$sum4 = (($65) + 2)|0;
     $67 = (5952 + ($$sum4<<2)|0);
     $68 = HEAP32[$67>>2]|0;
     $69 = ((($68)) + 8|0);
     $70 = HEAP32[$69>>2]|0;
     $71 = ($66|0)==($70|0);
     do {
      if ($71) {
       $72 = 1 << $64;
       $73 = $72 ^ -1;
       $74 = $6 & $73;
       HEAP32[5912>>2] = $74;
       $88 = $34;
      } else {
       $75 = HEAP32[(5928)>>2]|0;
       $76 = ($70>>>0)<($75>>>0);
       if ($76) {
        _abort();
        // unreachable;
       }
       $77 = ((($70)) + 12|0);
       $78 = HEAP32[$77>>2]|0;
       $79 = ($78|0)==($68|0);
       if ($79) {
        HEAP32[$77>>2] = $66;
        HEAP32[$67>>2] = $70;
        $$pre = HEAP32[(5920)>>2]|0;
        $88 = $$pre;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $80 = $64 << 3;
     $81 = (($80) - ($4))|0;
     $82 = $4 | 3;
     $83 = ((($68)) + 4|0);
     HEAP32[$83>>2] = $82;
     $84 = (($68) + ($4)|0);
     $85 = $81 | 1;
     $$sum56 = $4 | 4;
     $86 = (($68) + ($$sum56)|0);
     HEAP32[$86>>2] = $85;
     $87 = (($68) + ($80)|0);
     HEAP32[$87>>2] = $81;
     $89 = ($88|0)==(0);
     if (!($89)) {
      $90 = HEAP32[(5932)>>2]|0;
      $91 = $88 >>> 3;
      $92 = $91 << 1;
      $93 = (5952 + ($92<<2)|0);
      $94 = HEAP32[5912>>2]|0;
      $95 = 1 << $91;
      $96 = $94 & $95;
      $97 = ($96|0)==(0);
      if ($97) {
       $98 = $94 | $95;
       HEAP32[5912>>2] = $98;
       $$pre105 = (($92) + 2)|0;
       $$pre106 = (5952 + ($$pre105<<2)|0);
       $$pre$phiZ2D = $$pre106;$F4$0 = $93;
      } else {
       $$sum9 = (($92) + 2)|0;
       $99 = (5952 + ($$sum9<<2)|0);
       $100 = HEAP32[$99>>2]|0;
       $101 = HEAP32[(5928)>>2]|0;
       $102 = ($100>>>0)<($101>>>0);
       if ($102) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $99;$F4$0 = $100;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $90;
      $103 = ((($F4$0)) + 12|0);
      HEAP32[$103>>2] = $90;
      $104 = ((($90)) + 8|0);
      HEAP32[$104>>2] = $F4$0;
      $105 = ((($90)) + 12|0);
      HEAP32[$105>>2] = $93;
     }
     HEAP32[(5920)>>2] = $81;
     HEAP32[(5932)>>2] = $84;
     $mem$0 = $69;
     return ($mem$0|0);
    }
    $106 = HEAP32[(5916)>>2]|0;
    $107 = ($106|0)==(0);
    if ($107) {
     $nb$0 = $4;
    } else {
     $108 = (0 - ($106))|0;
     $109 = $106 & $108;
     $110 = (($109) + -1)|0;
     $111 = $110 >>> 12;
     $112 = $111 & 16;
     $113 = $110 >>> $112;
     $114 = $113 >>> 5;
     $115 = $114 & 8;
     $116 = $115 | $112;
     $117 = $113 >>> $115;
     $118 = $117 >>> 2;
     $119 = $118 & 4;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = $121 >>> 1;
     $123 = $122 & 2;
     $124 = $120 | $123;
     $125 = $121 >>> $123;
     $126 = $125 >>> 1;
     $127 = $126 & 1;
     $128 = $124 | $127;
     $129 = $125 >>> $127;
     $130 = (($128) + ($129))|0;
     $131 = (6216 + ($130<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ((($132)) + 4|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = $134 & -8;
     $136 = (($135) - ($4))|0;
     $rsize$0$i = $136;$t$0$i = $132;$v$0$i = $132;
     while(1) {
      $137 = ((($t$0$i)) + 16|0);
      $138 = HEAP32[$137>>2]|0;
      $139 = ($138|0)==(0|0);
      if ($139) {
       $140 = ((($t$0$i)) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        $rsize$0$i$lcssa = $rsize$0$i;$v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $144 = $141;
       }
      } else {
       $144 = $138;
      }
      $143 = ((($144)) + 4|0);
      $145 = HEAP32[$143>>2]|0;
      $146 = $145 & -8;
      $147 = (($146) - ($4))|0;
      $148 = ($147>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $148 ? $147 : $rsize$0$i;
      $$v$0$i = $148 ? $144 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $144;$v$0$i = $$v$0$i;
     }
     $149 = HEAP32[(5928)>>2]|0;
     $150 = ($v$0$i$lcssa>>>0)<($149>>>0);
     if ($150) {
      _abort();
      // unreachable;
     }
     $151 = (($v$0$i$lcssa) + ($4)|0);
     $152 = ($v$0$i$lcssa>>>0)<($151>>>0);
     if (!($152)) {
      _abort();
      // unreachable;
     }
     $153 = ((($v$0$i$lcssa)) + 24|0);
     $154 = HEAP32[$153>>2]|0;
     $155 = ((($v$0$i$lcssa)) + 12|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ($156|0)==($v$0$i$lcssa|0);
     do {
      if ($157) {
       $167 = ((($v$0$i$lcssa)) + 20|0);
       $168 = HEAP32[$167>>2]|0;
       $169 = ($168|0)==(0|0);
       if ($169) {
        $170 = ((($v$0$i$lcssa)) + 16|0);
        $171 = HEAP32[$170>>2]|0;
        $172 = ($171|0)==(0|0);
        if ($172) {
         $R$1$i = 0;
         break;
        } else {
         $R$0$i = $171;$RP$0$i = $170;
        }
       } else {
        $R$0$i = $168;$RP$0$i = $167;
       }
       while(1) {
        $173 = ((($R$0$i)) + 20|0);
        $174 = HEAP32[$173>>2]|0;
        $175 = ($174|0)==(0|0);
        if (!($175)) {
         $R$0$i = $174;$RP$0$i = $173;
         continue;
        }
        $176 = ((($R$0$i)) + 16|0);
        $177 = HEAP32[$176>>2]|0;
        $178 = ($177|0)==(0|0);
        if ($178) {
         $R$0$i$lcssa = $R$0$i;$RP$0$i$lcssa = $RP$0$i;
         break;
        } else {
         $R$0$i = $177;$RP$0$i = $176;
        }
       }
       $179 = ($RP$0$i$lcssa>>>0)<($149>>>0);
       if ($179) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$0$i$lcssa>>2] = 0;
        $R$1$i = $R$0$i$lcssa;
        break;
       }
      } else {
       $158 = ((($v$0$i$lcssa)) + 8|0);
       $159 = HEAP32[$158>>2]|0;
       $160 = ($159>>>0)<($149>>>0);
       if ($160) {
        _abort();
        // unreachable;
       }
       $161 = ((($159)) + 12|0);
       $162 = HEAP32[$161>>2]|0;
       $163 = ($162|0)==($v$0$i$lcssa|0);
       if (!($163)) {
        _abort();
        // unreachable;
       }
       $164 = ((($156)) + 8|0);
       $165 = HEAP32[$164>>2]|0;
       $166 = ($165|0)==($v$0$i$lcssa|0);
       if ($166) {
        HEAP32[$161>>2] = $156;
        HEAP32[$164>>2] = $159;
        $R$1$i = $156;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $180 = ($154|0)==(0|0);
     do {
      if (!($180)) {
       $181 = ((($v$0$i$lcssa)) + 28|0);
       $182 = HEAP32[$181>>2]|0;
       $183 = (6216 + ($182<<2)|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($v$0$i$lcssa|0)==($184|0);
       if ($185) {
        HEAP32[$183>>2] = $R$1$i;
        $cond$i = ($R$1$i|0)==(0|0);
        if ($cond$i) {
         $186 = 1 << $182;
         $187 = $186 ^ -1;
         $188 = HEAP32[(5916)>>2]|0;
         $189 = $188 & $187;
         HEAP32[(5916)>>2] = $189;
         break;
        }
       } else {
        $190 = HEAP32[(5928)>>2]|0;
        $191 = ($154>>>0)<($190>>>0);
        if ($191) {
         _abort();
         // unreachable;
        }
        $192 = ((($154)) + 16|0);
        $193 = HEAP32[$192>>2]|0;
        $194 = ($193|0)==($v$0$i$lcssa|0);
        if ($194) {
         HEAP32[$192>>2] = $R$1$i;
        } else {
         $195 = ((($154)) + 20|0);
         HEAP32[$195>>2] = $R$1$i;
        }
        $196 = ($R$1$i|0)==(0|0);
        if ($196) {
         break;
        }
       }
       $197 = HEAP32[(5928)>>2]|0;
       $198 = ($R$1$i>>>0)<($197>>>0);
       if ($198) {
        _abort();
        // unreachable;
       }
       $199 = ((($R$1$i)) + 24|0);
       HEAP32[$199>>2] = $154;
       $200 = ((($v$0$i$lcssa)) + 16|0);
       $201 = HEAP32[$200>>2]|0;
       $202 = ($201|0)==(0|0);
       do {
        if (!($202)) {
         $203 = ($201>>>0)<($197>>>0);
         if ($203) {
          _abort();
          // unreachable;
         } else {
          $204 = ((($R$1$i)) + 16|0);
          HEAP32[$204>>2] = $201;
          $205 = ((($201)) + 24|0);
          HEAP32[$205>>2] = $R$1$i;
          break;
         }
        }
       } while(0);
       $206 = ((($v$0$i$lcssa)) + 20|0);
       $207 = HEAP32[$206>>2]|0;
       $208 = ($207|0)==(0|0);
       if (!($208)) {
        $209 = HEAP32[(5928)>>2]|0;
        $210 = ($207>>>0)<($209>>>0);
        if ($210) {
         _abort();
         // unreachable;
        } else {
         $211 = ((($R$1$i)) + 20|0);
         HEAP32[$211>>2] = $207;
         $212 = ((($207)) + 24|0);
         HEAP32[$212>>2] = $R$1$i;
         break;
        }
       }
      }
     } while(0);
     $213 = ($rsize$0$i$lcssa>>>0)<(16);
     if ($213) {
      $214 = (($rsize$0$i$lcssa) + ($4))|0;
      $215 = $214 | 3;
      $216 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$216>>2] = $215;
      $$sum4$i = (($214) + 4)|0;
      $217 = (($v$0$i$lcssa) + ($$sum4$i)|0);
      $218 = HEAP32[$217>>2]|0;
      $219 = $218 | 1;
      HEAP32[$217>>2] = $219;
     } else {
      $220 = $4 | 3;
      $221 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$221>>2] = $220;
      $222 = $rsize$0$i$lcssa | 1;
      $$sum$i35 = $4 | 4;
      $223 = (($v$0$i$lcssa) + ($$sum$i35)|0);
      HEAP32[$223>>2] = $222;
      $$sum1$i = (($rsize$0$i$lcssa) + ($4))|0;
      $224 = (($v$0$i$lcssa) + ($$sum1$i)|0);
      HEAP32[$224>>2] = $rsize$0$i$lcssa;
      $225 = HEAP32[(5920)>>2]|0;
      $226 = ($225|0)==(0);
      if (!($226)) {
       $227 = HEAP32[(5932)>>2]|0;
       $228 = $225 >>> 3;
       $229 = $228 << 1;
       $230 = (5952 + ($229<<2)|0);
       $231 = HEAP32[5912>>2]|0;
       $232 = 1 << $228;
       $233 = $231 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $231 | $232;
        HEAP32[5912>>2] = $235;
        $$pre$i = (($229) + 2)|0;
        $$pre8$i = (5952 + ($$pre$i<<2)|0);
        $$pre$phi$iZ2D = $$pre8$i;$F1$0$i = $230;
       } else {
        $$sum3$i = (($229) + 2)|0;
        $236 = (5952 + ($$sum3$i<<2)|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(5928)>>2]|0;
        $239 = ($237>>>0)<($238>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $236;$F1$0$i = $237;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $227;
       $240 = ((($F1$0$i)) + 12|0);
       HEAP32[$240>>2] = $227;
       $241 = ((($227)) + 8|0);
       HEAP32[$241>>2] = $F1$0$i;
       $242 = ((($227)) + 12|0);
       HEAP32[$242>>2] = $230;
      }
      HEAP32[(5920)>>2] = $rsize$0$i$lcssa;
      HEAP32[(5932)>>2] = $151;
     }
     $243 = ((($v$0$i$lcssa)) + 8|0);
     $mem$0 = $243;
     return ($mem$0|0);
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $244 = ($bytes>>>0)>(4294967231);
   if ($244) {
    $nb$0 = -1;
   } else {
    $245 = (($bytes) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(5916)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $nb$0 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $idx$0$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $idx$0$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $idx$0$i = $274;
      }
     }
     $275 = (6216 + ($idx$0$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L9: do {
      if ($277) {
       $rsize$2$i = $249;$t$1$i = 0;$v$2$i = 0;
       label = 86;
      } else {
       $278 = ($idx$0$i|0)==(31);
       $279 = $idx$0$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $rsize$0$i15 = $249;$rst$0$i = 0;$sizebits$0$i = $282;$t$0$i14 = $276;$v$0$i16 = 0;
       while(1) {
        $283 = ((($t$0$i14)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($rsize$0$i15>>>0);
        if ($287) {
         $288 = ($285|0)==($246|0);
         if ($288) {
          $rsize$331$i = $286;$t$230$i = $t$0$i14;$v$332$i = $t$0$i14;
          label = 90;
          break L9;
         } else {
          $rsize$1$i = $286;$v$1$i = $t$0$i14;
         }
        } else {
         $rsize$1$i = $rsize$0$i15;$v$1$i = $v$0$i16;
        }
        $289 = ((($t$0$i14)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $sizebits$0$i >>> 31;
        $292 = (((($t$0$i14)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond19$i = $294 | $295;
        $rst$1$i = $or$cond19$i ? $rst$0$i : $290;
        $296 = ($293|0)==(0|0);
        $297 = $sizebits$0$i << 1;
        if ($296) {
         $rsize$2$i = $rsize$1$i;$t$1$i = $rst$1$i;$v$2$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i15 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $297;$t$0$i14 = $293;$v$0$i16 = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $298 = ($t$1$i|0)==(0|0);
      $299 = ($v$2$i|0)==(0|0);
      $or$cond$i = $298 & $299;
      if ($or$cond$i) {
       $300 = 2 << $idx$0$i;
       $301 = (0 - ($300))|0;
       $302 = $300 | $301;
       $303 = $247 & $302;
       $304 = ($303|0)==(0);
       if ($304) {
        $nb$0 = $246;
        break;
       }
       $305 = (0 - ($303))|0;
       $306 = $303 & $305;
       $307 = (($306) + -1)|0;
       $308 = $307 >>> 12;
       $309 = $308 & 16;
       $310 = $307 >>> $309;
       $311 = $310 >>> 5;
       $312 = $311 & 8;
       $313 = $312 | $309;
       $314 = $310 >>> $312;
       $315 = $314 >>> 2;
       $316 = $315 & 4;
       $317 = $313 | $316;
       $318 = $314 >>> $316;
       $319 = $318 >>> 1;
       $320 = $319 & 2;
       $321 = $317 | $320;
       $322 = $318 >>> $320;
       $323 = $322 >>> 1;
       $324 = $323 & 1;
       $325 = $321 | $324;
       $326 = $322 >>> $324;
       $327 = (($325) + ($326))|0;
       $328 = (6216 + ($327<<2)|0);
       $329 = HEAP32[$328>>2]|0;
       $t$2$ph$i = $329;$v$3$ph$i = 0;
      } else {
       $t$2$ph$i = $t$1$i;$v$3$ph$i = $v$2$i;
      }
      $330 = ($t$2$ph$i|0)==(0|0);
      if ($330) {
       $rsize$3$lcssa$i = $rsize$2$i;$v$3$lcssa$i = $v$3$ph$i;
      } else {
       $rsize$331$i = $rsize$2$i;$t$230$i = $t$2$ph$i;$v$332$i = $v$3$ph$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $331 = ((($t$230$i)) + 4|0);
       $332 = HEAP32[$331>>2]|0;
       $333 = $332 & -8;
       $334 = (($333) - ($246))|0;
       $335 = ($334>>>0)<($rsize$331$i>>>0);
       $$rsize$3$i = $335 ? $334 : $rsize$331$i;
       $t$2$v$3$i = $335 ? $t$230$i : $v$332$i;
       $336 = ((($t$230$i)) + 16|0);
       $337 = HEAP32[$336>>2]|0;
       $338 = ($337|0)==(0|0);
       if (!($338)) {
        $rsize$331$i = $$rsize$3$i;$t$230$i = $337;$v$332$i = $t$2$v$3$i;
        label = 90;
        continue;
       }
       $339 = ((($t$230$i)) + 20|0);
       $340 = HEAP32[$339>>2]|0;
       $341 = ($340|0)==(0|0);
       if ($341) {
        $rsize$3$lcssa$i = $$rsize$3$i;$v$3$lcssa$i = $t$2$v$3$i;
        break;
       } else {
        $rsize$331$i = $$rsize$3$i;$t$230$i = $340;$v$332$i = $t$2$v$3$i;
        label = 90;
       }
      }
     }
     $342 = ($v$3$lcssa$i|0)==(0|0);
     if ($342) {
      $nb$0 = $246;
     } else {
      $343 = HEAP32[(5920)>>2]|0;
      $344 = (($343) - ($246))|0;
      $345 = ($rsize$3$lcssa$i>>>0)<($344>>>0);
      if ($345) {
       $346 = HEAP32[(5928)>>2]|0;
       $347 = ($v$3$lcssa$i>>>0)<($346>>>0);
       if ($347) {
        _abort();
        // unreachable;
       }
       $348 = (($v$3$lcssa$i) + ($246)|0);
       $349 = ($v$3$lcssa$i>>>0)<($348>>>0);
       if (!($349)) {
        _abort();
        // unreachable;
       }
       $350 = ((($v$3$lcssa$i)) + 24|0);
       $351 = HEAP32[$350>>2]|0;
       $352 = ((($v$3$lcssa$i)) + 12|0);
       $353 = HEAP32[$352>>2]|0;
       $354 = ($353|0)==($v$3$lcssa$i|0);
       do {
        if ($354) {
         $364 = ((($v$3$lcssa$i)) + 20|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==(0|0);
         if ($366) {
          $367 = ((($v$3$lcssa$i)) + 16|0);
          $368 = HEAP32[$367>>2]|0;
          $369 = ($368|0)==(0|0);
          if ($369) {
           $R$1$i20 = 0;
           break;
          } else {
           $R$0$i18 = $368;$RP$0$i17 = $367;
          }
         } else {
          $R$0$i18 = $365;$RP$0$i17 = $364;
         }
         while(1) {
          $370 = ((($R$0$i18)) + 20|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if (!($372)) {
           $R$0$i18 = $371;$RP$0$i17 = $370;
           continue;
          }
          $373 = ((($R$0$i18)) + 16|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if ($375) {
           $R$0$i18$lcssa = $R$0$i18;$RP$0$i17$lcssa = $RP$0$i17;
           break;
          } else {
           $R$0$i18 = $374;$RP$0$i17 = $373;
          }
         }
         $376 = ($RP$0$i17$lcssa>>>0)<($346>>>0);
         if ($376) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$0$i17$lcssa>>2] = 0;
          $R$1$i20 = $R$0$i18$lcssa;
          break;
         }
        } else {
         $355 = ((($v$3$lcssa$i)) + 8|0);
         $356 = HEAP32[$355>>2]|0;
         $357 = ($356>>>0)<($346>>>0);
         if ($357) {
          _abort();
          // unreachable;
         }
         $358 = ((($356)) + 12|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==($v$3$lcssa$i|0);
         if (!($360)) {
          _abort();
          // unreachable;
         }
         $361 = ((($353)) + 8|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($v$3$lcssa$i|0);
         if ($363) {
          HEAP32[$358>>2] = $353;
          HEAP32[$361>>2] = $356;
          $R$1$i20 = $353;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $377 = ($351|0)==(0|0);
       do {
        if (!($377)) {
         $378 = ((($v$3$lcssa$i)) + 28|0);
         $379 = HEAP32[$378>>2]|0;
         $380 = (6216 + ($379<<2)|0);
         $381 = HEAP32[$380>>2]|0;
         $382 = ($v$3$lcssa$i|0)==($381|0);
         if ($382) {
          HEAP32[$380>>2] = $R$1$i20;
          $cond$i21 = ($R$1$i20|0)==(0|0);
          if ($cond$i21) {
           $383 = 1 << $379;
           $384 = $383 ^ -1;
           $385 = HEAP32[(5916)>>2]|0;
           $386 = $385 & $384;
           HEAP32[(5916)>>2] = $386;
           break;
          }
         } else {
          $387 = HEAP32[(5928)>>2]|0;
          $388 = ($351>>>0)<($387>>>0);
          if ($388) {
           _abort();
           // unreachable;
          }
          $389 = ((($351)) + 16|0);
          $390 = HEAP32[$389>>2]|0;
          $391 = ($390|0)==($v$3$lcssa$i|0);
          if ($391) {
           HEAP32[$389>>2] = $R$1$i20;
          } else {
           $392 = ((($351)) + 20|0);
           HEAP32[$392>>2] = $R$1$i20;
          }
          $393 = ($R$1$i20|0)==(0|0);
          if ($393) {
           break;
          }
         }
         $394 = HEAP32[(5928)>>2]|0;
         $395 = ($R$1$i20>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($R$1$i20)) + 24|0);
         HEAP32[$396>>2] = $351;
         $397 = ((($v$3$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($R$1$i20)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $R$1$i20;
            break;
           }
          }
         } while(0);
         $403 = ((($v$3$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if (!($405)) {
          $406 = HEAP32[(5928)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($R$1$i20)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $R$1$i20;
           break;
          }
         }
        }
       } while(0);
       $410 = ($rsize$3$lcssa$i>>>0)<(16);
       L85: do {
        if ($410) {
         $411 = (($rsize$3$lcssa$i) + ($246))|0;
         $412 = $411 | 3;
         $413 = ((($v$3$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $$sum18$i = (($411) + 4)|0;
         $414 = (($v$3$lcssa$i) + ($$sum18$i)|0);
         $415 = HEAP32[$414>>2]|0;
         $416 = $415 | 1;
         HEAP32[$414>>2] = $416;
        } else {
         $417 = $246 | 3;
         $418 = ((($v$3$lcssa$i)) + 4|0);
         HEAP32[$418>>2] = $417;
         $419 = $rsize$3$lcssa$i | 1;
         $$sum$i2334 = $246 | 4;
         $420 = (($v$3$lcssa$i) + ($$sum$i2334)|0);
         HEAP32[$420>>2] = $419;
         $$sum1$i24 = (($rsize$3$lcssa$i) + ($246))|0;
         $421 = (($v$3$lcssa$i) + ($$sum1$i24)|0);
         HEAP32[$421>>2] = $rsize$3$lcssa$i;
         $422 = $rsize$3$lcssa$i >>> 3;
         $423 = ($rsize$3$lcssa$i>>>0)<(256);
         if ($423) {
          $424 = $422 << 1;
          $425 = (5952 + ($424<<2)|0);
          $426 = HEAP32[5912>>2]|0;
          $427 = 1 << $422;
          $428 = $426 & $427;
          $429 = ($428|0)==(0);
          if ($429) {
           $430 = $426 | $427;
           HEAP32[5912>>2] = $430;
           $$pre$i25 = (($424) + 2)|0;
           $$pre43$i = (5952 + ($$pre$i25<<2)|0);
           $$pre$phi$i26Z2D = $$pre43$i;$F5$0$i = $425;
          } else {
           $$sum17$i = (($424) + 2)|0;
           $431 = (5952 + ($$sum17$i<<2)|0);
           $432 = HEAP32[$431>>2]|0;
           $433 = HEAP32[(5928)>>2]|0;
           $434 = ($432>>>0)<($433>>>0);
           if ($434) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i26Z2D = $431;$F5$0$i = $432;
           }
          }
          HEAP32[$$pre$phi$i26Z2D>>2] = $348;
          $435 = ((($F5$0$i)) + 12|0);
          HEAP32[$435>>2] = $348;
          $$sum15$i = (($246) + 8)|0;
          $436 = (($v$3$lcssa$i) + ($$sum15$i)|0);
          HEAP32[$436>>2] = $F5$0$i;
          $$sum16$i = (($246) + 12)|0;
          $437 = (($v$3$lcssa$i) + ($$sum16$i)|0);
          HEAP32[$437>>2] = $425;
          break;
         }
         $438 = $rsize$3$lcssa$i >>> 8;
         $439 = ($438|0)==(0);
         if ($439) {
          $I7$0$i = 0;
         } else {
          $440 = ($rsize$3$lcssa$i>>>0)>(16777215);
          if ($440) {
           $I7$0$i = 31;
          } else {
           $441 = (($438) + 1048320)|0;
           $442 = $441 >>> 16;
           $443 = $442 & 8;
           $444 = $438 << $443;
           $445 = (($444) + 520192)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 4;
           $448 = $447 | $443;
           $449 = $444 << $447;
           $450 = (($449) + 245760)|0;
           $451 = $450 >>> 16;
           $452 = $451 & 2;
           $453 = $448 | $452;
           $454 = (14 - ($453))|0;
           $455 = $449 << $452;
           $456 = $455 >>> 15;
           $457 = (($454) + ($456))|0;
           $458 = $457 << 1;
           $459 = (($457) + 7)|0;
           $460 = $rsize$3$lcssa$i >>> $459;
           $461 = $460 & 1;
           $462 = $461 | $458;
           $I7$0$i = $462;
          }
         }
         $463 = (6216 + ($I7$0$i<<2)|0);
         $$sum2$i = (($246) + 28)|0;
         $464 = (($v$3$lcssa$i) + ($$sum2$i)|0);
         HEAP32[$464>>2] = $I7$0$i;
         $$sum3$i27 = (($246) + 16)|0;
         $465 = (($v$3$lcssa$i) + ($$sum3$i27)|0);
         $$sum4$i28 = (($246) + 20)|0;
         $466 = (($v$3$lcssa$i) + ($$sum4$i28)|0);
         HEAP32[$466>>2] = 0;
         HEAP32[$465>>2] = 0;
         $467 = HEAP32[(5916)>>2]|0;
         $468 = 1 << $I7$0$i;
         $469 = $467 & $468;
         $470 = ($469|0)==(0);
         if ($470) {
          $471 = $467 | $468;
          HEAP32[(5916)>>2] = $471;
          HEAP32[$463>>2] = $348;
          $$sum5$i = (($246) + 24)|0;
          $472 = (($v$3$lcssa$i) + ($$sum5$i)|0);
          HEAP32[$472>>2] = $463;
          $$sum6$i = (($246) + 12)|0;
          $473 = (($v$3$lcssa$i) + ($$sum6$i)|0);
          HEAP32[$473>>2] = $348;
          $$sum7$i = (($246) + 8)|0;
          $474 = (($v$3$lcssa$i) + ($$sum7$i)|0);
          HEAP32[$474>>2] = $348;
          break;
         }
         $475 = HEAP32[$463>>2]|0;
         $476 = ((($475)) + 4|0);
         $477 = HEAP32[$476>>2]|0;
         $478 = $477 & -8;
         $479 = ($478|0)==($rsize$3$lcssa$i|0);
         L102: do {
          if ($479) {
           $T$0$lcssa$i = $475;
          } else {
           $480 = ($I7$0$i|0)==(31);
           $481 = $I7$0$i >>> 1;
           $482 = (25 - ($481))|0;
           $483 = $480 ? 0 : $482;
           $484 = $rsize$3$lcssa$i << $483;
           $K12$029$i = $484;$T$028$i = $475;
           while(1) {
            $491 = $K12$029$i >>> 31;
            $492 = (((($T$028$i)) + 16|0) + ($491<<2)|0);
            $487 = HEAP32[$492>>2]|0;
            $493 = ($487|0)==(0|0);
            if ($493) {
             $$lcssa232 = $492;$T$028$i$lcssa = $T$028$i;
             break;
            }
            $485 = $K12$029$i << 1;
            $486 = ((($487)) + 4|0);
            $488 = HEAP32[$486>>2]|0;
            $489 = $488 & -8;
            $490 = ($489|0)==($rsize$3$lcssa$i|0);
            if ($490) {
             $T$0$lcssa$i = $487;
             break L102;
            } else {
             $K12$029$i = $485;$T$028$i = $487;
            }
           }
           $494 = HEAP32[(5928)>>2]|0;
           $495 = ($$lcssa232>>>0)<($494>>>0);
           if ($495) {
            _abort();
            // unreachable;
           } else {
            HEAP32[$$lcssa232>>2] = $348;
            $$sum11$i = (($246) + 24)|0;
            $496 = (($v$3$lcssa$i) + ($$sum11$i)|0);
            HEAP32[$496>>2] = $T$028$i$lcssa;
            $$sum12$i = (($246) + 12)|0;
            $497 = (($v$3$lcssa$i) + ($$sum12$i)|0);
            HEAP32[$497>>2] = $348;
            $$sum13$i = (($246) + 8)|0;
            $498 = (($v$3$lcssa$i) + ($$sum13$i)|0);
            HEAP32[$498>>2] = $348;
            break L85;
           }
          }
         } while(0);
         $499 = ((($T$0$lcssa$i)) + 8|0);
         $500 = HEAP32[$499>>2]|0;
         $501 = HEAP32[(5928)>>2]|0;
         $502 = ($500>>>0)>=($501>>>0);
         $not$$i = ($T$0$lcssa$i>>>0)>=($501>>>0);
         $503 = $502 & $not$$i;
         if ($503) {
          $504 = ((($500)) + 12|0);
          HEAP32[$504>>2] = $348;
          HEAP32[$499>>2] = $348;
          $$sum8$i = (($246) + 8)|0;
          $505 = (($v$3$lcssa$i) + ($$sum8$i)|0);
          HEAP32[$505>>2] = $500;
          $$sum9$i = (($246) + 12)|0;
          $506 = (($v$3$lcssa$i) + ($$sum9$i)|0);
          HEAP32[$506>>2] = $T$0$lcssa$i;
          $$sum10$i = (($246) + 24)|0;
          $507 = (($v$3$lcssa$i) + ($$sum10$i)|0);
          HEAP32[$507>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $508 = ((($v$3$lcssa$i)) + 8|0);
       $mem$0 = $508;
       return ($mem$0|0);
      } else {
       $nb$0 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $509 = HEAP32[(5920)>>2]|0;
 $510 = ($509>>>0)<($nb$0>>>0);
 if (!($510)) {
  $511 = (($509) - ($nb$0))|0;
  $512 = HEAP32[(5932)>>2]|0;
  $513 = ($511>>>0)>(15);
  if ($513) {
   $514 = (($512) + ($nb$0)|0);
   HEAP32[(5932)>>2] = $514;
   HEAP32[(5920)>>2] = $511;
   $515 = $511 | 1;
   $$sum2 = (($nb$0) + 4)|0;
   $516 = (($512) + ($$sum2)|0);
   HEAP32[$516>>2] = $515;
   $517 = (($512) + ($509)|0);
   HEAP32[$517>>2] = $511;
   $518 = $nb$0 | 3;
   $519 = ((($512)) + 4|0);
   HEAP32[$519>>2] = $518;
  } else {
   HEAP32[(5920)>>2] = 0;
   HEAP32[(5932)>>2] = 0;
   $520 = $509 | 3;
   $521 = ((($512)) + 4|0);
   HEAP32[$521>>2] = $520;
   $$sum1 = (($509) + 4)|0;
   $522 = (($512) + ($$sum1)|0);
   $523 = HEAP32[$522>>2]|0;
   $524 = $523 | 1;
   HEAP32[$522>>2] = $524;
  }
  $525 = ((($512)) + 8|0);
  $mem$0 = $525;
  return ($mem$0|0);
 }
 $526 = HEAP32[(5924)>>2]|0;
 $527 = ($526>>>0)>($nb$0>>>0);
 if ($527) {
  $528 = (($526) - ($nb$0))|0;
  HEAP32[(5924)>>2] = $528;
  $529 = HEAP32[(5936)>>2]|0;
  $530 = (($529) + ($nb$0)|0);
  HEAP32[(5936)>>2] = $530;
  $531 = $528 | 1;
  $$sum = (($nb$0) + 4)|0;
  $532 = (($529) + ($$sum)|0);
  HEAP32[$532>>2] = $531;
  $533 = $nb$0 | 3;
  $534 = ((($529)) + 4|0);
  HEAP32[$534>>2] = $533;
  $535 = ((($529)) + 8|0);
  $mem$0 = $535;
  return ($mem$0|0);
 }
 $536 = HEAP32[6384>>2]|0;
 $537 = ($536|0)==(0);
 do {
  if ($537) {
   $538 = (_sysconf(30)|0);
   $539 = (($538) + -1)|0;
   $540 = $539 & $538;
   $541 = ($540|0)==(0);
   if ($541) {
    HEAP32[(6392)>>2] = $538;
    HEAP32[(6388)>>2] = $538;
    HEAP32[(6396)>>2] = -1;
    HEAP32[(6400)>>2] = -1;
    HEAP32[(6404)>>2] = 0;
    HEAP32[(6356)>>2] = 0;
    $542 = (_time((0|0))|0);
    $543 = $542 & -16;
    $544 = $543 ^ 1431655768;
    HEAP32[6384>>2] = $544;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $545 = (($nb$0) + 48)|0;
 $546 = HEAP32[(6392)>>2]|0;
 $547 = (($nb$0) + 47)|0;
 $548 = (($546) + ($547))|0;
 $549 = (0 - ($546))|0;
 $550 = $548 & $549;
 $551 = ($550>>>0)>($nb$0>>>0);
 if (!($551)) {
  $mem$0 = 0;
  return ($mem$0|0);
 }
 $552 = HEAP32[(6352)>>2]|0;
 $553 = ($552|0)==(0);
 if (!($553)) {
  $554 = HEAP32[(6344)>>2]|0;
  $555 = (($554) + ($550))|0;
  $556 = ($555>>>0)<=($554>>>0);
  $557 = ($555>>>0)>($552>>>0);
  $or$cond1$i = $556 | $557;
  if ($or$cond1$i) {
   $mem$0 = 0;
   return ($mem$0|0);
  }
 }
 $558 = HEAP32[(6356)>>2]|0;
 $559 = $558 & 4;
 $560 = ($559|0)==(0);
 L258: do {
  if ($560) {
   $561 = HEAP32[(5936)>>2]|0;
   $562 = ($561|0)==(0|0);
   L260: do {
    if ($562) {
     label = 174;
    } else {
     $sp$0$i$i = (6360);
     while(1) {
      $563 = HEAP32[$sp$0$i$i>>2]|0;
      $564 = ($563>>>0)>($561>>>0);
      if (!($564)) {
       $565 = ((($sp$0$i$i)) + 4|0);
       $566 = HEAP32[$565>>2]|0;
       $567 = (($563) + ($566)|0);
       $568 = ($567>>>0)>($561>>>0);
       if ($568) {
        $$lcssa228 = $sp$0$i$i;$$lcssa230 = $565;
        break;
       }
      }
      $569 = ((($sp$0$i$i)) + 8|0);
      $570 = HEAP32[$569>>2]|0;
      $571 = ($570|0)==(0|0);
      if ($571) {
       label = 174;
       break L260;
      } else {
       $sp$0$i$i = $570;
      }
     }
     $594 = HEAP32[(5924)>>2]|0;
     $595 = (($548) - ($594))|0;
     $596 = $595 & $549;
     $597 = ($596>>>0)<(2147483647);
     if ($597) {
      $598 = (_sbrk(($596|0))|0);
      $599 = HEAP32[$$lcssa228>>2]|0;
      $600 = HEAP32[$$lcssa230>>2]|0;
      $601 = (($599) + ($600)|0);
      $602 = ($598|0)==($601|0);
      $$3$i = $602 ? $596 : 0;
      if ($602) {
       $603 = ($598|0)==((-1)|0);
       if ($603) {
        $tsize$0323944$i = $$3$i;
       } else {
        $tbase$255$i = $598;$tsize$254$i = $$3$i;
        label = 194;
        break L258;
       }
      } else {
       $br$0$ph$i = $598;$ssize$1$ph$i = $596;$tsize$0$ph$i = $$3$i;
       label = 184;
      }
     } else {
      $tsize$0323944$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 174) {
     $572 = (_sbrk(0)|0);
     $573 = ($572|0)==((-1)|0);
     if ($573) {
      $tsize$0323944$i = 0;
     } else {
      $574 = $572;
      $575 = HEAP32[(6388)>>2]|0;
      $576 = (($575) + -1)|0;
      $577 = $576 & $574;
      $578 = ($577|0)==(0);
      if ($578) {
       $ssize$0$i = $550;
      } else {
       $579 = (($576) + ($574))|0;
       $580 = (0 - ($575))|0;
       $581 = $579 & $580;
       $582 = (($550) - ($574))|0;
       $583 = (($582) + ($581))|0;
       $ssize$0$i = $583;
      }
      $584 = HEAP32[(6344)>>2]|0;
      $585 = (($584) + ($ssize$0$i))|0;
      $586 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $587 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i30 = $586 & $587;
      if ($or$cond$i30) {
       $588 = HEAP32[(6352)>>2]|0;
       $589 = ($588|0)==(0);
       if (!($589)) {
        $590 = ($585>>>0)<=($584>>>0);
        $591 = ($585>>>0)>($588>>>0);
        $or$cond2$i = $590 | $591;
        if ($or$cond2$i) {
         $tsize$0323944$i = 0;
         break;
        }
       }
       $592 = (_sbrk(($ssize$0$i|0))|0);
       $593 = ($592|0)==($572|0);
       $ssize$0$$i = $593 ? $ssize$0$i : 0;
       if ($593) {
        $tbase$255$i = $572;$tsize$254$i = $ssize$0$$i;
        label = 194;
        break L258;
       } else {
        $br$0$ph$i = $592;$ssize$1$ph$i = $ssize$0$i;$tsize$0$ph$i = $ssize$0$$i;
        label = 184;
       }
      } else {
       $tsize$0323944$i = 0;
      }
     }
    }
   } while(0);
   L280: do {
    if ((label|0) == 184) {
     $604 = (0 - ($ssize$1$ph$i))|0;
     $605 = ($br$0$ph$i|0)!=((-1)|0);
     $606 = ($ssize$1$ph$i>>>0)<(2147483647);
     $or$cond5$i = $606 & $605;
     $607 = ($545>>>0)>($ssize$1$ph$i>>>0);
     $or$cond6$i = $607 & $or$cond5$i;
     do {
      if ($or$cond6$i) {
       $608 = HEAP32[(6392)>>2]|0;
       $609 = (($547) - ($ssize$1$ph$i))|0;
       $610 = (($609) + ($608))|0;
       $611 = (0 - ($608))|0;
       $612 = $610 & $611;
       $613 = ($612>>>0)<(2147483647);
       if ($613) {
        $614 = (_sbrk(($612|0))|0);
        $615 = ($614|0)==((-1)|0);
        if ($615) {
         (_sbrk(($604|0))|0);
         $tsize$0323944$i = $tsize$0$ph$i;
         break L280;
        } else {
         $616 = (($612) + ($ssize$1$ph$i))|0;
         $ssize$2$i = $616;
         break;
        }
       } else {
        $ssize$2$i = $ssize$1$ph$i;
       }
      } else {
       $ssize$2$i = $ssize$1$ph$i;
      }
     } while(0);
     $617 = ($br$0$ph$i|0)==((-1)|0);
     if ($617) {
      $tsize$0323944$i = $tsize$0$ph$i;
     } else {
      $tbase$255$i = $br$0$ph$i;$tsize$254$i = $ssize$2$i;
      label = 194;
      break L258;
     }
    }
   } while(0);
   $618 = HEAP32[(6356)>>2]|0;
   $619 = $618 | 4;
   HEAP32[(6356)>>2] = $619;
   $tsize$1$i = $tsize$0323944$i;
   label = 191;
  } else {
   $tsize$1$i = 0;
   label = 191;
  }
 } while(0);
 if ((label|0) == 191) {
  $620 = ($550>>>0)<(2147483647);
  if ($620) {
   $621 = (_sbrk(($550|0))|0);
   $622 = (_sbrk(0)|0);
   $623 = ($621|0)!=((-1)|0);
   $624 = ($622|0)!=((-1)|0);
   $or$cond3$i = $623 & $624;
   $625 = ($621>>>0)<($622>>>0);
   $or$cond8$i = $625 & $or$cond3$i;
   if ($or$cond8$i) {
    $626 = $622;
    $627 = $621;
    $628 = (($626) - ($627))|0;
    $629 = (($nb$0) + 40)|0;
    $630 = ($628>>>0)>($629>>>0);
    $$tsize$1$i = $630 ? $628 : $tsize$1$i;
    if ($630) {
     $tbase$255$i = $621;$tsize$254$i = $$tsize$1$i;
     label = 194;
    }
   }
  }
 }
 if ((label|0) == 194) {
  $631 = HEAP32[(6344)>>2]|0;
  $632 = (($631) + ($tsize$254$i))|0;
  HEAP32[(6344)>>2] = $632;
  $633 = HEAP32[(6348)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(6348)>>2] = $632;
  }
  $635 = HEAP32[(5936)>>2]|0;
  $636 = ($635|0)==(0|0);
  L299: do {
   if ($636) {
    $637 = HEAP32[(5928)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($tbase$255$i>>>0)<($637>>>0);
    $or$cond9$i = $638 | $639;
    if ($or$cond9$i) {
     HEAP32[(5928)>>2] = $tbase$255$i;
    }
    HEAP32[(6360)>>2] = $tbase$255$i;
    HEAP32[(6364)>>2] = $tsize$254$i;
    HEAP32[(6372)>>2] = 0;
    $640 = HEAP32[6384>>2]|0;
    HEAP32[(5948)>>2] = $640;
    HEAP32[(5944)>>2] = -1;
    $i$02$i$i = 0;
    while(1) {
     $641 = $i$02$i$i << 1;
     $642 = (5952 + ($641<<2)|0);
     $$sum$i$i = (($641) + 3)|0;
     $643 = (5952 + ($$sum$i$i<<2)|0);
     HEAP32[$643>>2] = $642;
     $$sum1$i$i = (($641) + 2)|0;
     $644 = (5952 + ($$sum1$i$i<<2)|0);
     HEAP32[$644>>2] = $642;
     $645 = (($i$02$i$i) + 1)|0;
     $exitcond$i$i = ($645|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$02$i$i = $645;
     }
    }
    $646 = (($tsize$254$i) + -40)|0;
    $647 = ((($tbase$255$i)) + 8|0);
    $648 = $647;
    $649 = $648 & 7;
    $650 = ($649|0)==(0);
    $651 = (0 - ($648))|0;
    $652 = $651 & 7;
    $653 = $650 ? 0 : $652;
    $654 = (($tbase$255$i) + ($653)|0);
    $655 = (($646) - ($653))|0;
    HEAP32[(5936)>>2] = $654;
    HEAP32[(5924)>>2] = $655;
    $656 = $655 | 1;
    $$sum$i13$i = (($653) + 4)|0;
    $657 = (($tbase$255$i) + ($$sum$i13$i)|0);
    HEAP32[$657>>2] = $656;
    $$sum2$i$i = (($tsize$254$i) + -36)|0;
    $658 = (($tbase$255$i) + ($$sum2$i$i)|0);
    HEAP32[$658>>2] = 40;
    $659 = HEAP32[(6400)>>2]|0;
    HEAP32[(5940)>>2] = $659;
   } else {
    $sp$084$i = (6360);
    while(1) {
     $660 = HEAP32[$sp$084$i>>2]|0;
     $661 = ((($sp$084$i)) + 4|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = (($660) + ($662)|0);
     $664 = ($tbase$255$i|0)==($663|0);
     if ($664) {
      $$lcssa222 = $660;$$lcssa224 = $661;$$lcssa226 = $662;$sp$084$i$lcssa = $sp$084$i;
      label = 204;
      break;
     }
     $665 = ((($sp$084$i)) + 8|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = ($666|0)==(0|0);
     if ($667) {
      break;
     } else {
      $sp$084$i = $666;
     }
    }
    if ((label|0) == 204) {
     $668 = ((($sp$084$i$lcssa)) + 12|0);
     $669 = HEAP32[$668>>2]|0;
     $670 = $669 & 8;
     $671 = ($670|0)==(0);
     if ($671) {
      $672 = ($635>>>0)>=($$lcssa222>>>0);
      $673 = ($635>>>0)<($tbase$255$i>>>0);
      $or$cond57$i = $673 & $672;
      if ($or$cond57$i) {
       $674 = (($$lcssa226) + ($tsize$254$i))|0;
       HEAP32[$$lcssa224>>2] = $674;
       $675 = HEAP32[(5924)>>2]|0;
       $676 = (($675) + ($tsize$254$i))|0;
       $677 = ((($635)) + 8|0);
       $678 = $677;
       $679 = $678 & 7;
       $680 = ($679|0)==(0);
       $681 = (0 - ($678))|0;
       $682 = $681 & 7;
       $683 = $680 ? 0 : $682;
       $684 = (($635) + ($683)|0);
       $685 = (($676) - ($683))|0;
       HEAP32[(5936)>>2] = $684;
       HEAP32[(5924)>>2] = $685;
       $686 = $685 | 1;
       $$sum$i17$i = (($683) + 4)|0;
       $687 = (($635) + ($$sum$i17$i)|0);
       HEAP32[$687>>2] = $686;
       $$sum2$i18$i = (($676) + 4)|0;
       $688 = (($635) + ($$sum2$i18$i)|0);
       HEAP32[$688>>2] = 40;
       $689 = HEAP32[(6400)>>2]|0;
       HEAP32[(5940)>>2] = $689;
       break;
      }
     }
    }
    $690 = HEAP32[(5928)>>2]|0;
    $691 = ($tbase$255$i>>>0)<($690>>>0);
    if ($691) {
     HEAP32[(5928)>>2] = $tbase$255$i;
     $755 = $tbase$255$i;
    } else {
     $755 = $690;
    }
    $692 = (($tbase$255$i) + ($tsize$254$i)|0);
    $sp$183$i = (6360);
    while(1) {
     $693 = HEAP32[$sp$183$i>>2]|0;
     $694 = ($693|0)==($692|0);
     if ($694) {
      $$lcssa219 = $sp$183$i;$sp$183$i$lcssa = $sp$183$i;
      label = 212;
      break;
     }
     $695 = ((($sp$183$i)) + 8|0);
     $696 = HEAP32[$695>>2]|0;
     $697 = ($696|0)==(0|0);
     if ($697) {
      $sp$0$i$i$i = (6360);
      break;
     } else {
      $sp$183$i = $696;
     }
    }
    if ((label|0) == 212) {
     $698 = ((($sp$183$i$lcssa)) + 12|0);
     $699 = HEAP32[$698>>2]|0;
     $700 = $699 & 8;
     $701 = ($700|0)==(0);
     if ($701) {
      HEAP32[$$lcssa219>>2] = $tbase$255$i;
      $702 = ((($sp$183$i$lcssa)) + 4|0);
      $703 = HEAP32[$702>>2]|0;
      $704 = (($703) + ($tsize$254$i))|0;
      HEAP32[$702>>2] = $704;
      $705 = ((($tbase$255$i)) + 8|0);
      $706 = $705;
      $707 = $706 & 7;
      $708 = ($707|0)==(0);
      $709 = (0 - ($706))|0;
      $710 = $709 & 7;
      $711 = $708 ? 0 : $710;
      $712 = (($tbase$255$i) + ($711)|0);
      $$sum112$i = (($tsize$254$i) + 8)|0;
      $713 = (($tbase$255$i) + ($$sum112$i)|0);
      $714 = $713;
      $715 = $714 & 7;
      $716 = ($715|0)==(0);
      $717 = (0 - ($714))|0;
      $718 = $717 & 7;
      $719 = $716 ? 0 : $718;
      $$sum113$i = (($719) + ($tsize$254$i))|0;
      $720 = (($tbase$255$i) + ($$sum113$i)|0);
      $721 = $720;
      $722 = $712;
      $723 = (($721) - ($722))|0;
      $$sum$i19$i = (($711) + ($nb$0))|0;
      $724 = (($tbase$255$i) + ($$sum$i19$i)|0);
      $725 = (($723) - ($nb$0))|0;
      $726 = $nb$0 | 3;
      $$sum1$i20$i = (($711) + 4)|0;
      $727 = (($tbase$255$i) + ($$sum1$i20$i)|0);
      HEAP32[$727>>2] = $726;
      $728 = ($720|0)==($635|0);
      L317: do {
       if ($728) {
        $729 = HEAP32[(5924)>>2]|0;
        $730 = (($729) + ($725))|0;
        HEAP32[(5924)>>2] = $730;
        HEAP32[(5936)>>2] = $724;
        $731 = $730 | 1;
        $$sum42$i$i = (($$sum$i19$i) + 4)|0;
        $732 = (($tbase$255$i) + ($$sum42$i$i)|0);
        HEAP32[$732>>2] = $731;
       } else {
        $733 = HEAP32[(5932)>>2]|0;
        $734 = ($720|0)==($733|0);
        if ($734) {
         $735 = HEAP32[(5920)>>2]|0;
         $736 = (($735) + ($725))|0;
         HEAP32[(5920)>>2] = $736;
         HEAP32[(5932)>>2] = $724;
         $737 = $736 | 1;
         $$sum40$i$i = (($$sum$i19$i) + 4)|0;
         $738 = (($tbase$255$i) + ($$sum40$i$i)|0);
         HEAP32[$738>>2] = $737;
         $$sum41$i$i = (($736) + ($$sum$i19$i))|0;
         $739 = (($tbase$255$i) + ($$sum41$i$i)|0);
         HEAP32[$739>>2] = $736;
         break;
        }
        $$sum2$i21$i = (($tsize$254$i) + 4)|0;
        $$sum114$i = (($$sum2$i21$i) + ($719))|0;
        $740 = (($tbase$255$i) + ($$sum114$i)|0);
        $741 = HEAP32[$740>>2]|0;
        $742 = $741 & 3;
        $743 = ($742|0)==(1);
        if ($743) {
         $744 = $741 & -8;
         $745 = $741 >>> 3;
         $746 = ($741>>>0)<(256);
         L324: do {
          if ($746) {
           $$sum3738$i$i = $719 | 8;
           $$sum124$i = (($$sum3738$i$i) + ($tsize$254$i))|0;
           $747 = (($tbase$255$i) + ($$sum124$i)|0);
           $748 = HEAP32[$747>>2]|0;
           $$sum39$i$i = (($tsize$254$i) + 12)|0;
           $$sum125$i = (($$sum39$i$i) + ($719))|0;
           $749 = (($tbase$255$i) + ($$sum125$i)|0);
           $750 = HEAP32[$749>>2]|0;
           $751 = $745 << 1;
           $752 = (5952 + ($751<<2)|0);
           $753 = ($748|0)==($752|0);
           do {
            if (!($753)) {
             $754 = ($748>>>0)<($755>>>0);
             if ($754) {
              _abort();
              // unreachable;
             }
             $756 = ((($748)) + 12|0);
             $757 = HEAP32[$756>>2]|0;
             $758 = ($757|0)==($720|0);
             if ($758) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $759 = ($750|0)==($748|0);
           if ($759) {
            $760 = 1 << $745;
            $761 = $760 ^ -1;
            $762 = HEAP32[5912>>2]|0;
            $763 = $762 & $761;
            HEAP32[5912>>2] = $763;
            break;
           }
           $764 = ($750|0)==($752|0);
           do {
            if ($764) {
             $$pre57$i$i = ((($750)) + 8|0);
             $$pre$phi58$i$iZ2D = $$pre57$i$i;
            } else {
             $765 = ($750>>>0)<($755>>>0);
             if ($765) {
              _abort();
              // unreachable;
             }
             $766 = ((($750)) + 8|0);
             $767 = HEAP32[$766>>2]|0;
             $768 = ($767|0)==($720|0);
             if ($768) {
              $$pre$phi58$i$iZ2D = $766;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $769 = ((($748)) + 12|0);
           HEAP32[$769>>2] = $750;
           HEAP32[$$pre$phi58$i$iZ2D>>2] = $748;
          } else {
           $$sum34$i$i = $719 | 24;
           $$sum115$i = (($$sum34$i$i) + ($tsize$254$i))|0;
           $770 = (($tbase$255$i) + ($$sum115$i)|0);
           $771 = HEAP32[$770>>2]|0;
           $$sum5$i$i = (($tsize$254$i) + 12)|0;
           $$sum116$i = (($$sum5$i$i) + ($719))|0;
           $772 = (($tbase$255$i) + ($$sum116$i)|0);
           $773 = HEAP32[$772>>2]|0;
           $774 = ($773|0)==($720|0);
           do {
            if ($774) {
             $$sum67$i$i = $719 | 16;
             $$sum122$i = (($$sum2$i21$i) + ($$sum67$i$i))|0;
             $784 = (($tbase$255$i) + ($$sum122$i)|0);
             $785 = HEAP32[$784>>2]|0;
             $786 = ($785|0)==(0|0);
             if ($786) {
              $$sum123$i = (($$sum67$i$i) + ($tsize$254$i))|0;
              $787 = (($tbase$255$i) + ($$sum123$i)|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if ($789) {
               $R$1$i$i = 0;
               break;
              } else {
               $R$0$i$i = $788;$RP$0$i$i = $787;
              }
             } else {
              $R$0$i$i = $785;$RP$0$i$i = $784;
             }
             while(1) {
              $790 = ((($R$0$i$i)) + 20|0);
              $791 = HEAP32[$790>>2]|0;
              $792 = ($791|0)==(0|0);
              if (!($792)) {
               $R$0$i$i = $791;$RP$0$i$i = $790;
               continue;
              }
              $793 = ((($R$0$i$i)) + 16|0);
              $794 = HEAP32[$793>>2]|0;
              $795 = ($794|0)==(0|0);
              if ($795) {
               $R$0$i$i$lcssa = $R$0$i$i;$RP$0$i$i$lcssa = $RP$0$i$i;
               break;
              } else {
               $R$0$i$i = $794;$RP$0$i$i = $793;
              }
             }
             $796 = ($RP$0$i$i$lcssa>>>0)<($755>>>0);
             if ($796) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$0$i$i$lcssa>>2] = 0;
              $R$1$i$i = $R$0$i$i$lcssa;
              break;
             }
            } else {
             $$sum3536$i$i = $719 | 8;
             $$sum117$i = (($$sum3536$i$i) + ($tsize$254$i))|0;
             $775 = (($tbase$255$i) + ($$sum117$i)|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776>>>0)<($755>>>0);
             if ($777) {
              _abort();
              // unreachable;
             }
             $778 = ((($776)) + 12|0);
             $779 = HEAP32[$778>>2]|0;
             $780 = ($779|0)==($720|0);
             if (!($780)) {
              _abort();
              // unreachable;
             }
             $781 = ((($773)) + 8|0);
             $782 = HEAP32[$781>>2]|0;
             $783 = ($782|0)==($720|0);
             if ($783) {
              HEAP32[$778>>2] = $773;
              HEAP32[$781>>2] = $776;
              $R$1$i$i = $773;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $797 = ($771|0)==(0|0);
           if ($797) {
            break;
           }
           $$sum30$i$i = (($tsize$254$i) + 28)|0;
           $$sum118$i = (($$sum30$i$i) + ($719))|0;
           $798 = (($tbase$255$i) + ($$sum118$i)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = (6216 + ($799<<2)|0);
           $801 = HEAP32[$800>>2]|0;
           $802 = ($720|0)==($801|0);
           do {
            if ($802) {
             HEAP32[$800>>2] = $R$1$i$i;
             $cond$i$i = ($R$1$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $803 = 1 << $799;
             $804 = $803 ^ -1;
             $805 = HEAP32[(5916)>>2]|0;
             $806 = $805 & $804;
             HEAP32[(5916)>>2] = $806;
             break L324;
            } else {
             $807 = HEAP32[(5928)>>2]|0;
             $808 = ($771>>>0)<($807>>>0);
             if ($808) {
              _abort();
              // unreachable;
             }
             $809 = ((($771)) + 16|0);
             $810 = HEAP32[$809>>2]|0;
             $811 = ($810|0)==($720|0);
             if ($811) {
              HEAP32[$809>>2] = $R$1$i$i;
             } else {
              $812 = ((($771)) + 20|0);
              HEAP32[$812>>2] = $R$1$i$i;
             }
             $813 = ($R$1$i$i|0)==(0|0);
             if ($813) {
              break L324;
             }
            }
           } while(0);
           $814 = HEAP32[(5928)>>2]|0;
           $815 = ($R$1$i$i>>>0)<($814>>>0);
           if ($815) {
            _abort();
            // unreachable;
           }
           $816 = ((($R$1$i$i)) + 24|0);
           HEAP32[$816>>2] = $771;
           $$sum3132$i$i = $719 | 16;
           $$sum119$i = (($$sum3132$i$i) + ($tsize$254$i))|0;
           $817 = (($tbase$255$i) + ($$sum119$i)|0);
           $818 = HEAP32[$817>>2]|0;
           $819 = ($818|0)==(0|0);
           do {
            if (!($819)) {
             $820 = ($818>>>0)<($814>>>0);
             if ($820) {
              _abort();
              // unreachable;
             } else {
              $821 = ((($R$1$i$i)) + 16|0);
              HEAP32[$821>>2] = $818;
              $822 = ((($818)) + 24|0);
              HEAP32[$822>>2] = $R$1$i$i;
              break;
             }
            }
           } while(0);
           $$sum120$i = (($$sum2$i21$i) + ($$sum3132$i$i))|0;
           $823 = (($tbase$255$i) + ($$sum120$i)|0);
           $824 = HEAP32[$823>>2]|0;
           $825 = ($824|0)==(0|0);
           if ($825) {
            break;
           }
           $826 = HEAP32[(5928)>>2]|0;
           $827 = ($824>>>0)<($826>>>0);
           if ($827) {
            _abort();
            // unreachable;
           } else {
            $828 = ((($R$1$i$i)) + 20|0);
            HEAP32[$828>>2] = $824;
            $829 = ((($824)) + 24|0);
            HEAP32[$829>>2] = $R$1$i$i;
            break;
           }
          }
         } while(0);
         $$sum9$i$i = $744 | $719;
         $$sum121$i = (($$sum9$i$i) + ($tsize$254$i))|0;
         $830 = (($tbase$255$i) + ($$sum121$i)|0);
         $831 = (($744) + ($725))|0;
         $oldfirst$0$i$i = $830;$qsize$0$i$i = $831;
        } else {
         $oldfirst$0$i$i = $720;$qsize$0$i$i = $725;
        }
        $832 = ((($oldfirst$0$i$i)) + 4|0);
        $833 = HEAP32[$832>>2]|0;
        $834 = $833 & -2;
        HEAP32[$832>>2] = $834;
        $835 = $qsize$0$i$i | 1;
        $$sum10$i$i = (($$sum$i19$i) + 4)|0;
        $836 = (($tbase$255$i) + ($$sum10$i$i)|0);
        HEAP32[$836>>2] = $835;
        $$sum11$i$i = (($qsize$0$i$i) + ($$sum$i19$i))|0;
        $837 = (($tbase$255$i) + ($$sum11$i$i)|0);
        HEAP32[$837>>2] = $qsize$0$i$i;
        $838 = $qsize$0$i$i >>> 3;
        $839 = ($qsize$0$i$i>>>0)<(256);
        if ($839) {
         $840 = $838 << 1;
         $841 = (5952 + ($840<<2)|0);
         $842 = HEAP32[5912>>2]|0;
         $843 = 1 << $838;
         $844 = $842 & $843;
         $845 = ($844|0)==(0);
         do {
          if ($845) {
           $846 = $842 | $843;
           HEAP32[5912>>2] = $846;
           $$pre$i22$i = (($840) + 2)|0;
           $$pre56$i$i = (5952 + ($$pre$i22$i<<2)|0);
           $$pre$phi$i23$iZ2D = $$pre56$i$i;$F4$0$i$i = $841;
          } else {
           $$sum29$i$i = (($840) + 2)|0;
           $847 = (5952 + ($$sum29$i$i<<2)|0);
           $848 = HEAP32[$847>>2]|0;
           $849 = HEAP32[(5928)>>2]|0;
           $850 = ($848>>>0)<($849>>>0);
           if (!($850)) {
            $$pre$phi$i23$iZ2D = $847;$F4$0$i$i = $848;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i23$iZ2D>>2] = $724;
         $851 = ((($F4$0$i$i)) + 12|0);
         HEAP32[$851>>2] = $724;
         $$sum27$i$i = (($$sum$i19$i) + 8)|0;
         $852 = (($tbase$255$i) + ($$sum27$i$i)|0);
         HEAP32[$852>>2] = $F4$0$i$i;
         $$sum28$i$i = (($$sum$i19$i) + 12)|0;
         $853 = (($tbase$255$i) + ($$sum28$i$i)|0);
         HEAP32[$853>>2] = $841;
         break;
        }
        $854 = $qsize$0$i$i >>> 8;
        $855 = ($854|0)==(0);
        do {
         if ($855) {
          $I7$0$i$i = 0;
         } else {
          $856 = ($qsize$0$i$i>>>0)>(16777215);
          if ($856) {
           $I7$0$i$i = 31;
           break;
          }
          $857 = (($854) + 1048320)|0;
          $858 = $857 >>> 16;
          $859 = $858 & 8;
          $860 = $854 << $859;
          $861 = (($860) + 520192)|0;
          $862 = $861 >>> 16;
          $863 = $862 & 4;
          $864 = $863 | $859;
          $865 = $860 << $863;
          $866 = (($865) + 245760)|0;
          $867 = $866 >>> 16;
          $868 = $867 & 2;
          $869 = $864 | $868;
          $870 = (14 - ($869))|0;
          $871 = $865 << $868;
          $872 = $871 >>> 15;
          $873 = (($870) + ($872))|0;
          $874 = $873 << 1;
          $875 = (($873) + 7)|0;
          $876 = $qsize$0$i$i >>> $875;
          $877 = $876 & 1;
          $878 = $877 | $874;
          $I7$0$i$i = $878;
         }
        } while(0);
        $879 = (6216 + ($I7$0$i$i<<2)|0);
        $$sum12$i$i = (($$sum$i19$i) + 28)|0;
        $880 = (($tbase$255$i) + ($$sum12$i$i)|0);
        HEAP32[$880>>2] = $I7$0$i$i;
        $$sum13$i$i = (($$sum$i19$i) + 16)|0;
        $881 = (($tbase$255$i) + ($$sum13$i$i)|0);
        $$sum14$i$i = (($$sum$i19$i) + 20)|0;
        $882 = (($tbase$255$i) + ($$sum14$i$i)|0);
        HEAP32[$882>>2] = 0;
        HEAP32[$881>>2] = 0;
        $883 = HEAP32[(5916)>>2]|0;
        $884 = 1 << $I7$0$i$i;
        $885 = $883 & $884;
        $886 = ($885|0)==(0);
        if ($886) {
         $887 = $883 | $884;
         HEAP32[(5916)>>2] = $887;
         HEAP32[$879>>2] = $724;
         $$sum15$i$i = (($$sum$i19$i) + 24)|0;
         $888 = (($tbase$255$i) + ($$sum15$i$i)|0);
         HEAP32[$888>>2] = $879;
         $$sum16$i$i = (($$sum$i19$i) + 12)|0;
         $889 = (($tbase$255$i) + ($$sum16$i$i)|0);
         HEAP32[$889>>2] = $724;
         $$sum17$i$i = (($$sum$i19$i) + 8)|0;
         $890 = (($tbase$255$i) + ($$sum17$i$i)|0);
         HEAP32[$890>>2] = $724;
         break;
        }
        $891 = HEAP32[$879>>2]|0;
        $892 = ((($891)) + 4|0);
        $893 = HEAP32[$892>>2]|0;
        $894 = $893 & -8;
        $895 = ($894|0)==($qsize$0$i$i|0);
        L410: do {
         if ($895) {
          $T$0$lcssa$i25$i = $891;
         } else {
          $896 = ($I7$0$i$i|0)==(31);
          $897 = $I7$0$i$i >>> 1;
          $898 = (25 - ($897))|0;
          $899 = $896 ? 0 : $898;
          $900 = $qsize$0$i$i << $899;
          $K8$051$i$i = $900;$T$050$i$i = $891;
          while(1) {
           $907 = $K8$051$i$i >>> 31;
           $908 = (((($T$050$i$i)) + 16|0) + ($907<<2)|0);
           $903 = HEAP32[$908>>2]|0;
           $909 = ($903|0)==(0|0);
           if ($909) {
            $$lcssa = $908;$T$050$i$i$lcssa = $T$050$i$i;
            break;
           }
           $901 = $K8$051$i$i << 1;
           $902 = ((($903)) + 4|0);
           $904 = HEAP32[$902>>2]|0;
           $905 = $904 & -8;
           $906 = ($905|0)==($qsize$0$i$i|0);
           if ($906) {
            $T$0$lcssa$i25$i = $903;
            break L410;
           } else {
            $K8$051$i$i = $901;$T$050$i$i = $903;
           }
          }
          $910 = HEAP32[(5928)>>2]|0;
          $911 = ($$lcssa>>>0)<($910>>>0);
          if ($911) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$$lcssa>>2] = $724;
           $$sum23$i$i = (($$sum$i19$i) + 24)|0;
           $912 = (($tbase$255$i) + ($$sum23$i$i)|0);
           HEAP32[$912>>2] = $T$050$i$i$lcssa;
           $$sum24$i$i = (($$sum$i19$i) + 12)|0;
           $913 = (($tbase$255$i) + ($$sum24$i$i)|0);
           HEAP32[$913>>2] = $724;
           $$sum25$i$i = (($$sum$i19$i) + 8)|0;
           $914 = (($tbase$255$i) + ($$sum25$i$i)|0);
           HEAP32[$914>>2] = $724;
           break L317;
          }
         }
        } while(0);
        $915 = ((($T$0$lcssa$i25$i)) + 8|0);
        $916 = HEAP32[$915>>2]|0;
        $917 = HEAP32[(5928)>>2]|0;
        $918 = ($916>>>0)>=($917>>>0);
        $not$$i26$i = ($T$0$lcssa$i25$i>>>0)>=($917>>>0);
        $919 = $918 & $not$$i26$i;
        if ($919) {
         $920 = ((($916)) + 12|0);
         HEAP32[$920>>2] = $724;
         HEAP32[$915>>2] = $724;
         $$sum20$i$i = (($$sum$i19$i) + 8)|0;
         $921 = (($tbase$255$i) + ($$sum20$i$i)|0);
         HEAP32[$921>>2] = $916;
         $$sum21$i$i = (($$sum$i19$i) + 12)|0;
         $922 = (($tbase$255$i) + ($$sum21$i$i)|0);
         HEAP32[$922>>2] = $T$0$lcssa$i25$i;
         $$sum22$i$i = (($$sum$i19$i) + 24)|0;
         $923 = (($tbase$255$i) + ($$sum22$i$i)|0);
         HEAP32[$923>>2] = 0;
         break;
        } else {
         _abort();
         // unreachable;
        }
       }
      } while(0);
      $$sum1819$i$i = $711 | 8;
      $924 = (($tbase$255$i) + ($$sum1819$i$i)|0);
      $mem$0 = $924;
      return ($mem$0|0);
     } else {
      $sp$0$i$i$i = (6360);
     }
    }
    while(1) {
     $925 = HEAP32[$sp$0$i$i$i>>2]|0;
     $926 = ($925>>>0)>($635>>>0);
     if (!($926)) {
      $927 = ((($sp$0$i$i$i)) + 4|0);
      $928 = HEAP32[$927>>2]|0;
      $929 = (($925) + ($928)|0);
      $930 = ($929>>>0)>($635>>>0);
      if ($930) {
       $$lcssa215 = $925;$$lcssa216 = $928;$$lcssa217 = $929;
       break;
      }
     }
     $931 = ((($sp$0$i$i$i)) + 8|0);
     $932 = HEAP32[$931>>2]|0;
     $sp$0$i$i$i = $932;
    }
    $$sum$i14$i = (($$lcssa216) + -47)|0;
    $$sum1$i15$i = (($$lcssa216) + -39)|0;
    $933 = (($$lcssa215) + ($$sum1$i15$i)|0);
    $934 = $933;
    $935 = $934 & 7;
    $936 = ($935|0)==(0);
    $937 = (0 - ($934))|0;
    $938 = $937 & 7;
    $939 = $936 ? 0 : $938;
    $$sum2$i16$i = (($$sum$i14$i) + ($939))|0;
    $940 = (($$lcssa215) + ($$sum2$i16$i)|0);
    $941 = ((($635)) + 16|0);
    $942 = ($940>>>0)<($941>>>0);
    $943 = $942 ? $635 : $940;
    $944 = ((($943)) + 8|0);
    $945 = (($tsize$254$i) + -40)|0;
    $946 = ((($tbase$255$i)) + 8|0);
    $947 = $946;
    $948 = $947 & 7;
    $949 = ($948|0)==(0);
    $950 = (0 - ($947))|0;
    $951 = $950 & 7;
    $952 = $949 ? 0 : $951;
    $953 = (($tbase$255$i) + ($952)|0);
    $954 = (($945) - ($952))|0;
    HEAP32[(5936)>>2] = $953;
    HEAP32[(5924)>>2] = $954;
    $955 = $954 | 1;
    $$sum$i$i$i = (($952) + 4)|0;
    $956 = (($tbase$255$i) + ($$sum$i$i$i)|0);
    HEAP32[$956>>2] = $955;
    $$sum2$i$i$i = (($tsize$254$i) + -36)|0;
    $957 = (($tbase$255$i) + ($$sum2$i$i$i)|0);
    HEAP32[$957>>2] = 40;
    $958 = HEAP32[(6400)>>2]|0;
    HEAP32[(5940)>>2] = $958;
    $959 = ((($943)) + 4|0);
    HEAP32[$959>>2] = 27;
    ;HEAP32[$944>>2]=HEAP32[(6360)>>2]|0;HEAP32[$944+4>>2]=HEAP32[(6360)+4>>2]|0;HEAP32[$944+8>>2]=HEAP32[(6360)+8>>2]|0;HEAP32[$944+12>>2]=HEAP32[(6360)+12>>2]|0;
    HEAP32[(6360)>>2] = $tbase$255$i;
    HEAP32[(6364)>>2] = $tsize$254$i;
    HEAP32[(6372)>>2] = 0;
    HEAP32[(6368)>>2] = $944;
    $960 = ((($943)) + 28|0);
    HEAP32[$960>>2] = 7;
    $961 = ((($943)) + 32|0);
    $962 = ($961>>>0)<($$lcssa217>>>0);
    if ($962) {
     $964 = $960;
     while(1) {
      $963 = ((($964)) + 4|0);
      HEAP32[$963>>2] = 7;
      $965 = ((($964)) + 8|0);
      $966 = ($965>>>0)<($$lcssa217>>>0);
      if ($966) {
       $964 = $963;
      } else {
       break;
      }
     }
    }
    $967 = ($943|0)==($635|0);
    if (!($967)) {
     $968 = $943;
     $969 = $635;
     $970 = (($968) - ($969))|0;
     $971 = HEAP32[$959>>2]|0;
     $972 = $971 & -2;
     HEAP32[$959>>2] = $972;
     $973 = $970 | 1;
     $974 = ((($635)) + 4|0);
     HEAP32[$974>>2] = $973;
     HEAP32[$943>>2] = $970;
     $975 = $970 >>> 3;
     $976 = ($970>>>0)<(256);
     if ($976) {
      $977 = $975 << 1;
      $978 = (5952 + ($977<<2)|0);
      $979 = HEAP32[5912>>2]|0;
      $980 = 1 << $975;
      $981 = $979 & $980;
      $982 = ($981|0)==(0);
      if ($982) {
       $983 = $979 | $980;
       HEAP32[5912>>2] = $983;
       $$pre$i$i = (($977) + 2)|0;
       $$pre14$i$i = (5952 + ($$pre$i$i<<2)|0);
       $$pre$phi$i$iZ2D = $$pre14$i$i;$F$0$i$i = $978;
      } else {
       $$sum4$i$i = (($977) + 2)|0;
       $984 = (5952 + ($$sum4$i$i<<2)|0);
       $985 = HEAP32[$984>>2]|0;
       $986 = HEAP32[(5928)>>2]|0;
       $987 = ($985>>>0)<($986>>>0);
       if ($987) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $984;$F$0$i$i = $985;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $988 = ((($F$0$i$i)) + 12|0);
      HEAP32[$988>>2] = $635;
      $989 = ((($635)) + 8|0);
      HEAP32[$989>>2] = $F$0$i$i;
      $990 = ((($635)) + 12|0);
      HEAP32[$990>>2] = $978;
      break;
     }
     $991 = $970 >>> 8;
     $992 = ($991|0)==(0);
     if ($992) {
      $I1$0$i$i = 0;
     } else {
      $993 = ($970>>>0)>(16777215);
      if ($993) {
       $I1$0$i$i = 31;
      } else {
       $994 = (($991) + 1048320)|0;
       $995 = $994 >>> 16;
       $996 = $995 & 8;
       $997 = $991 << $996;
       $998 = (($997) + 520192)|0;
       $999 = $998 >>> 16;
       $1000 = $999 & 4;
       $1001 = $1000 | $996;
       $1002 = $997 << $1000;
       $1003 = (($1002) + 245760)|0;
       $1004 = $1003 >>> 16;
       $1005 = $1004 & 2;
       $1006 = $1001 | $1005;
       $1007 = (14 - ($1006))|0;
       $1008 = $1002 << $1005;
       $1009 = $1008 >>> 15;
       $1010 = (($1007) + ($1009))|0;
       $1011 = $1010 << 1;
       $1012 = (($1010) + 7)|0;
       $1013 = $970 >>> $1012;
       $1014 = $1013 & 1;
       $1015 = $1014 | $1011;
       $I1$0$i$i = $1015;
      }
     }
     $1016 = (6216 + ($I1$0$i$i<<2)|0);
     $1017 = ((($635)) + 28|0);
     HEAP32[$1017>>2] = $I1$0$i$i;
     $1018 = ((($635)) + 20|0);
     HEAP32[$1018>>2] = 0;
     HEAP32[$941>>2] = 0;
     $1019 = HEAP32[(5916)>>2]|0;
     $1020 = 1 << $I1$0$i$i;
     $1021 = $1019 & $1020;
     $1022 = ($1021|0)==(0);
     if ($1022) {
      $1023 = $1019 | $1020;
      HEAP32[(5916)>>2] = $1023;
      HEAP32[$1016>>2] = $635;
      $1024 = ((($635)) + 24|0);
      HEAP32[$1024>>2] = $1016;
      $1025 = ((($635)) + 12|0);
      HEAP32[$1025>>2] = $635;
      $1026 = ((($635)) + 8|0);
      HEAP32[$1026>>2] = $635;
      break;
     }
     $1027 = HEAP32[$1016>>2]|0;
     $1028 = ((($1027)) + 4|0);
     $1029 = HEAP32[$1028>>2]|0;
     $1030 = $1029 & -8;
     $1031 = ($1030|0)==($970|0);
     L452: do {
      if ($1031) {
       $T$0$lcssa$i$i = $1027;
      } else {
       $1032 = ($I1$0$i$i|0)==(31);
       $1033 = $I1$0$i$i >>> 1;
       $1034 = (25 - ($1033))|0;
       $1035 = $1032 ? 0 : $1034;
       $1036 = $970 << $1035;
       $K2$07$i$i = $1036;$T$06$i$i = $1027;
       while(1) {
        $1043 = $K2$07$i$i >>> 31;
        $1044 = (((($T$06$i$i)) + 16|0) + ($1043<<2)|0);
        $1039 = HEAP32[$1044>>2]|0;
        $1045 = ($1039|0)==(0|0);
        if ($1045) {
         $$lcssa211 = $1044;$T$06$i$i$lcssa = $T$06$i$i;
         break;
        }
        $1037 = $K2$07$i$i << 1;
        $1038 = ((($1039)) + 4|0);
        $1040 = HEAP32[$1038>>2]|0;
        $1041 = $1040 & -8;
        $1042 = ($1041|0)==($970|0);
        if ($1042) {
         $T$0$lcssa$i$i = $1039;
         break L452;
        } else {
         $K2$07$i$i = $1037;$T$06$i$i = $1039;
        }
       }
       $1046 = HEAP32[(5928)>>2]|0;
       $1047 = ($$lcssa211>>>0)<($1046>>>0);
       if ($1047) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$lcssa211>>2] = $635;
        $1048 = ((($635)) + 24|0);
        HEAP32[$1048>>2] = $T$06$i$i$lcssa;
        $1049 = ((($635)) + 12|0);
        HEAP32[$1049>>2] = $635;
        $1050 = ((($635)) + 8|0);
        HEAP32[$1050>>2] = $635;
        break L299;
       }
      }
     } while(0);
     $1051 = ((($T$0$lcssa$i$i)) + 8|0);
     $1052 = HEAP32[$1051>>2]|0;
     $1053 = HEAP32[(5928)>>2]|0;
     $1054 = ($1052>>>0)>=($1053>>>0);
     $not$$i$i = ($T$0$lcssa$i$i>>>0)>=($1053>>>0);
     $1055 = $1054 & $not$$i$i;
     if ($1055) {
      $1056 = ((($1052)) + 12|0);
      HEAP32[$1056>>2] = $635;
      HEAP32[$1051>>2] = $635;
      $1057 = ((($635)) + 8|0);
      HEAP32[$1057>>2] = $1052;
      $1058 = ((($635)) + 12|0);
      HEAP32[$1058>>2] = $T$0$lcssa$i$i;
      $1059 = ((($635)) + 24|0);
      HEAP32[$1059>>2] = 0;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   }
  } while(0);
  $1060 = HEAP32[(5924)>>2]|0;
  $1061 = ($1060>>>0)>($nb$0>>>0);
  if ($1061) {
   $1062 = (($1060) - ($nb$0))|0;
   HEAP32[(5924)>>2] = $1062;
   $1063 = HEAP32[(5936)>>2]|0;
   $1064 = (($1063) + ($nb$0)|0);
   HEAP32[(5936)>>2] = $1064;
   $1065 = $1062 | 1;
   $$sum$i32 = (($nb$0) + 4)|0;
   $1066 = (($1063) + ($$sum$i32)|0);
   HEAP32[$1066>>2] = $1065;
   $1067 = $nb$0 | 3;
   $1068 = ((($1063)) + 4|0);
   HEAP32[$1068>>2] = $1067;
   $1069 = ((($1063)) + 8|0);
   $mem$0 = $1069;
   return ($mem$0|0);
  }
 }
 $1070 = (___errno_location()|0);
 HEAP32[$1070>>2] = 12;
 $mem$0 = 0;
 return ($mem$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi59Z2D = 0, $$pre$phi61Z2D = 0, $$pre$phiZ2D = 0, $$pre57 = 0, $$pre58 = 0, $$pre60 = 0, $$sum = 0, $$sum11 = 0, $$sum12 = 0, $$sum13 = 0, $$sum14 = 0, $$sum1718 = 0, $$sum19 = 0, $$sum2 = 0, $$sum20 = 0, $$sum22 = 0, $$sum23 = 0, $$sum24 = 0;
 var $$sum25 = 0, $$sum26 = 0, $$sum27 = 0, $$sum28 = 0, $$sum29 = 0, $$sum3 = 0, $$sum30 = 0, $$sum31 = 0, $$sum5 = 0, $$sum67 = 0, $$sum8 = 0, $$sum9 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0;
 var $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0;
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0;
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0;
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F16$0 = 0, $I18$0 = 0, $K19$052 = 0, $R$0 = 0, $R$0$lcssa = 0, $R$1 = 0;
 var $R7$0 = 0, $R7$0$lcssa = 0, $R7$1 = 0, $RP$0 = 0, $RP$0$lcssa = 0, $RP9$0 = 0, $RP9$0$lcssa = 0, $T$0$lcssa = 0, $T$051 = 0, $T$051$lcssa = 0, $cond = 0, $cond47 = 0, $not$ = 0, $p$0 = 0, $psize$0 = 0, $psize$1 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  return;
 }
 $1 = ((($mem)) + -8|0);
 $2 = HEAP32[(5928)>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = ((($mem)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $$sum = (($8) + -8)|0;
 $9 = (($mem) + ($$sum)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    return;
   }
   $$sum2 = (-8 - ($12))|0;
   $14 = (($mem) + ($$sum2)|0);
   $15 = (($12) + ($8))|0;
   $16 = ($14>>>0)<($2>>>0);
   if ($16) {
    _abort();
    // unreachable;
   }
   $17 = HEAP32[(5932)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $$sum3 = (($8) + -4)|0;
    $103 = (($mem) + ($$sum3)|0);
    $104 = HEAP32[$103>>2]|0;
    $105 = $104 & 3;
    $106 = ($105|0)==(3);
    if (!($106)) {
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    HEAP32[(5920)>>2] = $15;
    $107 = $104 & -2;
    HEAP32[$103>>2] = $107;
    $108 = $15 | 1;
    $$sum20 = (($$sum2) + 4)|0;
    $109 = (($mem) + ($$sum20)|0);
    HEAP32[$109>>2] = $108;
    HEAP32[$9>>2] = $15;
    return;
   }
   $19 = $12 >>> 3;
   $20 = ($12>>>0)<(256);
   if ($20) {
    $$sum30 = (($$sum2) + 8)|0;
    $21 = (($mem) + ($$sum30)|0);
    $22 = HEAP32[$21>>2]|0;
    $$sum31 = (($$sum2) + 12)|0;
    $23 = (($mem) + ($$sum31)|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = $19 << 1;
    $26 = (5952 + ($25<<2)|0);
    $27 = ($22|0)==($26|0);
    if (!($27)) {
     $28 = ($22>>>0)<($2>>>0);
     if ($28) {
      _abort();
      // unreachable;
     }
     $29 = ((($22)) + 12|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = ($30|0)==($14|0);
     if (!($31)) {
      _abort();
      // unreachable;
     }
    }
    $32 = ($24|0)==($22|0);
    if ($32) {
     $33 = 1 << $19;
     $34 = $33 ^ -1;
     $35 = HEAP32[5912>>2]|0;
     $36 = $35 & $34;
     HEAP32[5912>>2] = $36;
     $p$0 = $14;$psize$0 = $15;
     break;
    }
    $37 = ($24|0)==($26|0);
    if ($37) {
     $$pre60 = ((($24)) + 8|0);
     $$pre$phi61Z2D = $$pre60;
    } else {
     $38 = ($24>>>0)<($2>>>0);
     if ($38) {
      _abort();
      // unreachable;
     }
     $39 = ((($24)) + 8|0);
     $40 = HEAP32[$39>>2]|0;
     $41 = ($40|0)==($14|0);
     if ($41) {
      $$pre$phi61Z2D = $39;
     } else {
      _abort();
      // unreachable;
     }
    }
    $42 = ((($22)) + 12|0);
    HEAP32[$42>>2] = $24;
    HEAP32[$$pre$phi61Z2D>>2] = $22;
    $p$0 = $14;$psize$0 = $15;
    break;
   }
   $$sum22 = (($$sum2) + 24)|0;
   $43 = (($mem) + ($$sum22)|0);
   $44 = HEAP32[$43>>2]|0;
   $$sum23 = (($$sum2) + 12)|0;
   $45 = (($mem) + ($$sum23)|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ($46|0)==($14|0);
   do {
    if ($47) {
     $$sum25 = (($$sum2) + 20)|0;
     $57 = (($mem) + ($$sum25)|0);
     $58 = HEAP32[$57>>2]|0;
     $59 = ($58|0)==(0|0);
     if ($59) {
      $$sum24 = (($$sum2) + 16)|0;
      $60 = (($mem) + ($$sum24)|0);
      $61 = HEAP32[$60>>2]|0;
      $62 = ($61|0)==(0|0);
      if ($62) {
       $R$1 = 0;
       break;
      } else {
       $R$0 = $61;$RP$0 = $60;
      }
     } else {
      $R$0 = $58;$RP$0 = $57;
     }
     while(1) {
      $63 = ((($R$0)) + 20|0);
      $64 = HEAP32[$63>>2]|0;
      $65 = ($64|0)==(0|0);
      if (!($65)) {
       $R$0 = $64;$RP$0 = $63;
       continue;
      }
      $66 = ((($R$0)) + 16|0);
      $67 = HEAP32[$66>>2]|0;
      $68 = ($67|0)==(0|0);
      if ($68) {
       $R$0$lcssa = $R$0;$RP$0$lcssa = $RP$0;
       break;
      } else {
       $R$0 = $67;$RP$0 = $66;
      }
     }
     $69 = ($RP$0$lcssa>>>0)<($2>>>0);
     if ($69) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$0$lcssa>>2] = 0;
      $R$1 = $R$0$lcssa;
      break;
     }
    } else {
     $$sum29 = (($$sum2) + 8)|0;
     $48 = (($mem) + ($$sum29)|0);
     $49 = HEAP32[$48>>2]|0;
     $50 = ($49>>>0)<($2>>>0);
     if ($50) {
      _abort();
      // unreachable;
     }
     $51 = ((($49)) + 12|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = ($52|0)==($14|0);
     if (!($53)) {
      _abort();
      // unreachable;
     }
     $54 = ((($46)) + 8|0);
     $55 = HEAP32[$54>>2]|0;
     $56 = ($55|0)==($14|0);
     if ($56) {
      HEAP32[$51>>2] = $46;
      HEAP32[$54>>2] = $49;
      $R$1 = $46;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $70 = ($44|0)==(0|0);
   if ($70) {
    $p$0 = $14;$psize$0 = $15;
   } else {
    $$sum26 = (($$sum2) + 28)|0;
    $71 = (($mem) + ($$sum26)|0);
    $72 = HEAP32[$71>>2]|0;
    $73 = (6216 + ($72<<2)|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($14|0)==($74|0);
    if ($75) {
     HEAP32[$73>>2] = $R$1;
     $cond = ($R$1|0)==(0|0);
     if ($cond) {
      $76 = 1 << $72;
      $77 = $76 ^ -1;
      $78 = HEAP32[(5916)>>2]|0;
      $79 = $78 & $77;
      HEAP32[(5916)>>2] = $79;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    } else {
     $80 = HEAP32[(5928)>>2]|0;
     $81 = ($44>>>0)<($80>>>0);
     if ($81) {
      _abort();
      // unreachable;
     }
     $82 = ((($44)) + 16|0);
     $83 = HEAP32[$82>>2]|0;
     $84 = ($83|0)==($14|0);
     if ($84) {
      HEAP32[$82>>2] = $R$1;
     } else {
      $85 = ((($44)) + 20|0);
      HEAP32[$85>>2] = $R$1;
     }
     $86 = ($R$1|0)==(0|0);
     if ($86) {
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
    $87 = HEAP32[(5928)>>2]|0;
    $88 = ($R$1>>>0)<($87>>>0);
    if ($88) {
     _abort();
     // unreachable;
    }
    $89 = ((($R$1)) + 24|0);
    HEAP32[$89>>2] = $44;
    $$sum27 = (($$sum2) + 16)|0;
    $90 = (($mem) + ($$sum27)|0);
    $91 = HEAP32[$90>>2]|0;
    $92 = ($91|0)==(0|0);
    do {
     if (!($92)) {
      $93 = ($91>>>0)<($87>>>0);
      if ($93) {
       _abort();
       // unreachable;
      } else {
       $94 = ((($R$1)) + 16|0);
       HEAP32[$94>>2] = $91;
       $95 = ((($91)) + 24|0);
       HEAP32[$95>>2] = $R$1;
       break;
      }
     }
    } while(0);
    $$sum28 = (($$sum2) + 20)|0;
    $96 = (($mem) + ($$sum28)|0);
    $97 = HEAP32[$96>>2]|0;
    $98 = ($97|0)==(0|0);
    if ($98) {
     $p$0 = $14;$psize$0 = $15;
    } else {
     $99 = HEAP32[(5928)>>2]|0;
     $100 = ($97>>>0)<($99>>>0);
     if ($100) {
      _abort();
      // unreachable;
     } else {
      $101 = ((($R$1)) + 20|0);
      HEAP32[$101>>2] = $97;
      $102 = ((($97)) + 24|0);
      HEAP32[$102>>2] = $R$1;
      $p$0 = $14;$psize$0 = $15;
      break;
     }
    }
   }
  } else {
   $p$0 = $1;$psize$0 = $8;
  }
 } while(0);
 $110 = ($p$0>>>0)<($9>>>0);
 if (!($110)) {
  _abort();
  // unreachable;
 }
 $$sum19 = (($8) + -4)|0;
 $111 = (($mem) + ($$sum19)|0);
 $112 = HEAP32[$111>>2]|0;
 $113 = $112 & 1;
 $114 = ($113|0)==(0);
 if ($114) {
  _abort();
  // unreachable;
 }
 $115 = $112 & 2;
 $116 = ($115|0)==(0);
 if ($116) {
  $117 = HEAP32[(5936)>>2]|0;
  $118 = ($9|0)==($117|0);
  if ($118) {
   $119 = HEAP32[(5924)>>2]|0;
   $120 = (($119) + ($psize$0))|0;
   HEAP32[(5924)>>2] = $120;
   HEAP32[(5936)>>2] = $p$0;
   $121 = $120 | 1;
   $122 = ((($p$0)) + 4|0);
   HEAP32[$122>>2] = $121;
   $123 = HEAP32[(5932)>>2]|0;
   $124 = ($p$0|0)==($123|0);
   if (!($124)) {
    return;
   }
   HEAP32[(5932)>>2] = 0;
   HEAP32[(5920)>>2] = 0;
   return;
  }
  $125 = HEAP32[(5932)>>2]|0;
  $126 = ($9|0)==($125|0);
  if ($126) {
   $127 = HEAP32[(5920)>>2]|0;
   $128 = (($127) + ($psize$0))|0;
   HEAP32[(5920)>>2] = $128;
   HEAP32[(5932)>>2] = $p$0;
   $129 = $128 | 1;
   $130 = ((($p$0)) + 4|0);
   HEAP32[$130>>2] = $129;
   $131 = (($p$0) + ($128)|0);
   HEAP32[$131>>2] = $128;
   return;
  }
  $132 = $112 & -8;
  $133 = (($132) + ($psize$0))|0;
  $134 = $112 >>> 3;
  $135 = ($112>>>0)<(256);
  do {
   if ($135) {
    $136 = (($mem) + ($8)|0);
    $137 = HEAP32[$136>>2]|0;
    $$sum1718 = $8 | 4;
    $138 = (($mem) + ($$sum1718)|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = $134 << 1;
    $141 = (5952 + ($140<<2)|0);
    $142 = ($137|0)==($141|0);
    if (!($142)) {
     $143 = HEAP32[(5928)>>2]|0;
     $144 = ($137>>>0)<($143>>>0);
     if ($144) {
      _abort();
      // unreachable;
     }
     $145 = ((($137)) + 12|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = ($146|0)==($9|0);
     if (!($147)) {
      _abort();
      // unreachable;
     }
    }
    $148 = ($139|0)==($137|0);
    if ($148) {
     $149 = 1 << $134;
     $150 = $149 ^ -1;
     $151 = HEAP32[5912>>2]|0;
     $152 = $151 & $150;
     HEAP32[5912>>2] = $152;
     break;
    }
    $153 = ($139|0)==($141|0);
    if ($153) {
     $$pre58 = ((($139)) + 8|0);
     $$pre$phi59Z2D = $$pre58;
    } else {
     $154 = HEAP32[(5928)>>2]|0;
     $155 = ($139>>>0)<($154>>>0);
     if ($155) {
      _abort();
      // unreachable;
     }
     $156 = ((($139)) + 8|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==($9|0);
     if ($158) {
      $$pre$phi59Z2D = $156;
     } else {
      _abort();
      // unreachable;
     }
    }
    $159 = ((($137)) + 12|0);
    HEAP32[$159>>2] = $139;
    HEAP32[$$pre$phi59Z2D>>2] = $137;
   } else {
    $$sum5 = (($8) + 16)|0;
    $160 = (($mem) + ($$sum5)|0);
    $161 = HEAP32[$160>>2]|0;
    $$sum67 = $8 | 4;
    $162 = (($mem) + ($$sum67)|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ($163|0)==($9|0);
    do {
     if ($164) {
      $$sum9 = (($8) + 12)|0;
      $175 = (($mem) + ($$sum9)|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = ($176|0)==(0|0);
      if ($177) {
       $$sum8 = (($8) + 8)|0;
       $178 = (($mem) + ($$sum8)|0);
       $179 = HEAP32[$178>>2]|0;
       $180 = ($179|0)==(0|0);
       if ($180) {
        $R7$1 = 0;
        break;
       } else {
        $R7$0 = $179;$RP9$0 = $178;
       }
      } else {
       $R7$0 = $176;$RP9$0 = $175;
      }
      while(1) {
       $181 = ((($R7$0)) + 20|0);
       $182 = HEAP32[$181>>2]|0;
       $183 = ($182|0)==(0|0);
       if (!($183)) {
        $R7$0 = $182;$RP9$0 = $181;
        continue;
       }
       $184 = ((($R7$0)) + 16|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($185|0)==(0|0);
       if ($186) {
        $R7$0$lcssa = $R7$0;$RP9$0$lcssa = $RP9$0;
        break;
       } else {
        $R7$0 = $185;$RP9$0 = $184;
       }
      }
      $187 = HEAP32[(5928)>>2]|0;
      $188 = ($RP9$0$lcssa>>>0)<($187>>>0);
      if ($188) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP9$0$lcssa>>2] = 0;
       $R7$1 = $R7$0$lcssa;
       break;
      }
     } else {
      $165 = (($mem) + ($8)|0);
      $166 = HEAP32[$165>>2]|0;
      $167 = HEAP32[(5928)>>2]|0;
      $168 = ($166>>>0)<($167>>>0);
      if ($168) {
       _abort();
       // unreachable;
      }
      $169 = ((($166)) + 12|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = ($170|0)==($9|0);
      if (!($171)) {
       _abort();
       // unreachable;
      }
      $172 = ((($163)) + 8|0);
      $173 = HEAP32[$172>>2]|0;
      $174 = ($173|0)==($9|0);
      if ($174) {
       HEAP32[$169>>2] = $163;
       HEAP32[$172>>2] = $166;
       $R7$1 = $163;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $189 = ($161|0)==(0|0);
    if (!($189)) {
     $$sum12 = (($8) + 20)|0;
     $190 = (($mem) + ($$sum12)|0);
     $191 = HEAP32[$190>>2]|0;
     $192 = (6216 + ($191<<2)|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = ($9|0)==($193|0);
     if ($194) {
      HEAP32[$192>>2] = $R7$1;
      $cond47 = ($R7$1|0)==(0|0);
      if ($cond47) {
       $195 = 1 << $191;
       $196 = $195 ^ -1;
       $197 = HEAP32[(5916)>>2]|0;
       $198 = $197 & $196;
       HEAP32[(5916)>>2] = $198;
       break;
      }
     } else {
      $199 = HEAP32[(5928)>>2]|0;
      $200 = ($161>>>0)<($199>>>0);
      if ($200) {
       _abort();
       // unreachable;
      }
      $201 = ((($161)) + 16|0);
      $202 = HEAP32[$201>>2]|0;
      $203 = ($202|0)==($9|0);
      if ($203) {
       HEAP32[$201>>2] = $R7$1;
      } else {
       $204 = ((($161)) + 20|0);
       HEAP32[$204>>2] = $R7$1;
      }
      $205 = ($R7$1|0)==(0|0);
      if ($205) {
       break;
      }
     }
     $206 = HEAP32[(5928)>>2]|0;
     $207 = ($R7$1>>>0)<($206>>>0);
     if ($207) {
      _abort();
      // unreachable;
     }
     $208 = ((($R7$1)) + 24|0);
     HEAP32[$208>>2] = $161;
     $$sum13 = (($8) + 8)|0;
     $209 = (($mem) + ($$sum13)|0);
     $210 = HEAP32[$209>>2]|0;
     $211 = ($210|0)==(0|0);
     do {
      if (!($211)) {
       $212 = ($210>>>0)<($206>>>0);
       if ($212) {
        _abort();
        // unreachable;
       } else {
        $213 = ((($R7$1)) + 16|0);
        HEAP32[$213>>2] = $210;
        $214 = ((($210)) + 24|0);
        HEAP32[$214>>2] = $R7$1;
        break;
       }
      }
     } while(0);
     $$sum14 = (($8) + 12)|0;
     $215 = (($mem) + ($$sum14)|0);
     $216 = HEAP32[$215>>2]|0;
     $217 = ($216|0)==(0|0);
     if (!($217)) {
      $218 = HEAP32[(5928)>>2]|0;
      $219 = ($216>>>0)<($218>>>0);
      if ($219) {
       _abort();
       // unreachable;
      } else {
       $220 = ((($R7$1)) + 20|0);
       HEAP32[$220>>2] = $216;
       $221 = ((($216)) + 24|0);
       HEAP32[$221>>2] = $R7$1;
       break;
      }
     }
    }
   }
  } while(0);
  $222 = $133 | 1;
  $223 = ((($p$0)) + 4|0);
  HEAP32[$223>>2] = $222;
  $224 = (($p$0) + ($133)|0);
  HEAP32[$224>>2] = $133;
  $225 = HEAP32[(5932)>>2]|0;
  $226 = ($p$0|0)==($225|0);
  if ($226) {
   HEAP32[(5920)>>2] = $133;
   return;
  } else {
   $psize$1 = $133;
  }
 } else {
  $227 = $112 & -2;
  HEAP32[$111>>2] = $227;
  $228 = $psize$0 | 1;
  $229 = ((($p$0)) + 4|0);
  HEAP32[$229>>2] = $228;
  $230 = (($p$0) + ($psize$0)|0);
  HEAP32[$230>>2] = $psize$0;
  $psize$1 = $psize$0;
 }
 $231 = $psize$1 >>> 3;
 $232 = ($psize$1>>>0)<(256);
 if ($232) {
  $233 = $231 << 1;
  $234 = (5952 + ($233<<2)|0);
  $235 = HEAP32[5912>>2]|0;
  $236 = 1 << $231;
  $237 = $235 & $236;
  $238 = ($237|0)==(0);
  if ($238) {
   $239 = $235 | $236;
   HEAP32[5912>>2] = $239;
   $$pre = (($233) + 2)|0;
   $$pre57 = (5952 + ($$pre<<2)|0);
   $$pre$phiZ2D = $$pre57;$F16$0 = $234;
  } else {
   $$sum11 = (($233) + 2)|0;
   $240 = (5952 + ($$sum11<<2)|0);
   $241 = HEAP32[$240>>2]|0;
   $242 = HEAP32[(5928)>>2]|0;
   $243 = ($241>>>0)<($242>>>0);
   if ($243) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $240;$F16$0 = $241;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$0;
  $244 = ((($F16$0)) + 12|0);
  HEAP32[$244>>2] = $p$0;
  $245 = ((($p$0)) + 8|0);
  HEAP32[$245>>2] = $F16$0;
  $246 = ((($p$0)) + 12|0);
  HEAP32[$246>>2] = $234;
  return;
 }
 $247 = $psize$1 >>> 8;
 $248 = ($247|0)==(0);
 if ($248) {
  $I18$0 = 0;
 } else {
  $249 = ($psize$1>>>0)>(16777215);
  if ($249) {
   $I18$0 = 31;
  } else {
   $250 = (($247) + 1048320)|0;
   $251 = $250 >>> 16;
   $252 = $251 & 8;
   $253 = $247 << $252;
   $254 = (($253) + 520192)|0;
   $255 = $254 >>> 16;
   $256 = $255 & 4;
   $257 = $256 | $252;
   $258 = $253 << $256;
   $259 = (($258) + 245760)|0;
   $260 = $259 >>> 16;
   $261 = $260 & 2;
   $262 = $257 | $261;
   $263 = (14 - ($262))|0;
   $264 = $258 << $261;
   $265 = $264 >>> 15;
   $266 = (($263) + ($265))|0;
   $267 = $266 << 1;
   $268 = (($266) + 7)|0;
   $269 = $psize$1 >>> $268;
   $270 = $269 & 1;
   $271 = $270 | $267;
   $I18$0 = $271;
  }
 }
 $272 = (6216 + ($I18$0<<2)|0);
 $273 = ((($p$0)) + 28|0);
 HEAP32[$273>>2] = $I18$0;
 $274 = ((($p$0)) + 16|0);
 $275 = ((($p$0)) + 20|0);
 HEAP32[$275>>2] = 0;
 HEAP32[$274>>2] = 0;
 $276 = HEAP32[(5916)>>2]|0;
 $277 = 1 << $I18$0;
 $278 = $276 & $277;
 $279 = ($278|0)==(0);
 L199: do {
  if ($279) {
   $280 = $276 | $277;
   HEAP32[(5916)>>2] = $280;
   HEAP32[$272>>2] = $p$0;
   $281 = ((($p$0)) + 24|0);
   HEAP32[$281>>2] = $272;
   $282 = ((($p$0)) + 12|0);
   HEAP32[$282>>2] = $p$0;
   $283 = ((($p$0)) + 8|0);
   HEAP32[$283>>2] = $p$0;
  } else {
   $284 = HEAP32[$272>>2]|0;
   $285 = ((($284)) + 4|0);
   $286 = HEAP32[$285>>2]|0;
   $287 = $286 & -8;
   $288 = ($287|0)==($psize$1|0);
   L202: do {
    if ($288) {
     $T$0$lcssa = $284;
    } else {
     $289 = ($I18$0|0)==(31);
     $290 = $I18$0 >>> 1;
     $291 = (25 - ($290))|0;
     $292 = $289 ? 0 : $291;
     $293 = $psize$1 << $292;
     $K19$052 = $293;$T$051 = $284;
     while(1) {
      $300 = $K19$052 >>> 31;
      $301 = (((($T$051)) + 16|0) + ($300<<2)|0);
      $296 = HEAP32[$301>>2]|0;
      $302 = ($296|0)==(0|0);
      if ($302) {
       $$lcssa = $301;$T$051$lcssa = $T$051;
       break;
      }
      $294 = $K19$052 << 1;
      $295 = ((($296)) + 4|0);
      $297 = HEAP32[$295>>2]|0;
      $298 = $297 & -8;
      $299 = ($298|0)==($psize$1|0);
      if ($299) {
       $T$0$lcssa = $296;
       break L202;
      } else {
       $K19$052 = $294;$T$051 = $296;
      }
     }
     $303 = HEAP32[(5928)>>2]|0;
     $304 = ($$lcssa>>>0)<($303>>>0);
     if ($304) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$lcssa>>2] = $p$0;
      $305 = ((($p$0)) + 24|0);
      HEAP32[$305>>2] = $T$051$lcssa;
      $306 = ((($p$0)) + 12|0);
      HEAP32[$306>>2] = $p$0;
      $307 = ((($p$0)) + 8|0);
      HEAP32[$307>>2] = $p$0;
      break L199;
     }
    }
   } while(0);
   $308 = ((($T$0$lcssa)) + 8|0);
   $309 = HEAP32[$308>>2]|0;
   $310 = HEAP32[(5928)>>2]|0;
   $311 = ($309>>>0)>=($310>>>0);
   $not$ = ($T$0$lcssa>>>0)>=($310>>>0);
   $312 = $311 & $not$;
   if ($312) {
    $313 = ((($309)) + 12|0);
    HEAP32[$313>>2] = $p$0;
    HEAP32[$308>>2] = $p$0;
    $314 = ((($p$0)) + 8|0);
    HEAP32[$314>>2] = $309;
    $315 = ((($p$0)) + 12|0);
    HEAP32[$315>>2] = $T$0$lcssa;
    $316 = ((($p$0)) + 24|0);
    HEAP32[$316>>2] = 0;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $317 = HEAP32[(5944)>>2]|0;
 $318 = (($317) + -1)|0;
 HEAP32[(5944)>>2] = $318;
 $319 = ($318|0)==(0);
 if ($319) {
  $sp$0$in$i = (6368);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $320 = ($sp$0$i|0)==(0|0);
  $321 = ((($sp$0$i)) + 8|0);
  if ($320) {
   break;
  } else {
   $sp$0$in$i = $321;
  }
 }
 HEAP32[(5944)>>2] = -1;
 return;
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEC2ERKS5_($this,$__str) {
 $this = $this|0;
 $__str = $__str|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[$__str>>0]|0;
 $1 = $0 & 1;
 $2 = ($1<<24>>24)==(0);
 if ($2) {
  ;HEAP32[$this>>2]=HEAP32[$__str>>2]|0;HEAP32[$this+4>>2]=HEAP32[$__str+4>>2]|0;HEAP32[$this+8>>2]=HEAP32[$__str+8>>2]|0;
 } else {
  $3 = ((($__str)) + 8|0);
  $4 = HEAP32[$3>>2]|0;
  $5 = ((($__str)) + 4|0);
  $6 = HEAP32[$5>>2]|0;
  __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcj($this,$4,$6);
 }
 return;
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcj($this,$__s,$__sz) {
 $this = $this|0;
 $__s = $__s|0;
 $__sz = $__sz|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $__p$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($__sz>>>0)>(4294967279);
 if ($0) {
  __ZNKSt3__121__basic_string_commonILb1EE20__throw_length_errorEv($this);
  // unreachable;
 }
 $1 = ($__sz>>>0)<(11);
 if ($1) {
  $2 = $__sz << 1;
  $3 = $2&255;
  HEAP8[$this>>0] = $3;
  $4 = ((($this)) + 1|0);
  $__p$0 = $4;
 } else {
  $5 = (($__sz) + 16)|0;
  $6 = $5 & -16;
  $7 = (__Znwj($6)|0);
  $8 = ((($this)) + 8|0);
  HEAP32[$8>>2] = $7;
  $9 = $6 | 1;
  HEAP32[$this>>2] = $9;
  $10 = ((($this)) + 4|0);
  HEAP32[$10>>2] = $__sz;
  $__p$0 = $7;
 }
 _memcpy(($__p$0|0),($__s|0),($__sz|0))|0;
 $11 = (($__p$0) + ($__sz)|0);
 HEAP8[$11>>0] = 0;
 return;
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev($this) {
 $this = $this|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[$this>>0]|0;
 $1 = $0 & 1;
 $2 = ($1<<24>>24)==(0);
 if (!($2)) {
  $3 = ((($this)) + 8|0);
  $4 = HEAP32[$3>>2]|0;
  __ZdlPv($4);
 }
 return;
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSERKS5_($this,$__str) {
 $this = $this|0;
 $__str = $__str|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($this|0)==($__str|0);
 if (!($0)) {
  $1 = HEAP8[$__str>>0]|0;
  $2 = $1 & 1;
  $3 = ($2<<24>>24)==(0);
  $4 = ((($__str)) + 8|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = ((($__str)) + 1|0);
  $7 = $3 ? $6 : $5;
  $8 = ((($__str)) + 4|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $1&255;
  $11 = $10 >>> 1;
  $12 = $3 ? $11 : $9;
  (__ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6assignEPKcj($this,$7,$12)|0);
 }
 return ($this|0);
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6assignEPKcj($this,$__s,$__n) {
 $this = $this|0;
 $__s = $__s|0;
 $__n = $__n|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP8[$this>>0]|0;
 $1 = $0 & 1;
 $2 = ($1<<24>>24)==(0);
 if ($2) {
  $6 = 10;$9 = $0;
 } else {
  $3 = HEAP32[$this>>2]|0;
  $4 = $3 & -2;
  $phitmp$i = (($4) + -1)|0;
  $5 = $3&255;
  $6 = $phitmp$i;$9 = $5;
 }
 $7 = ($6>>>0)<($__n>>>0);
 $8 = $9 & 1;
 $10 = ($8<<24>>24)==(0);
 do {
  if ($7) {
   if ($10) {
    $24 = $9&255;
    $25 = $24 >>> 1;
    $27 = $25;
   } else {
    $22 = ((($this)) + 4|0);
    $23 = HEAP32[$22>>2]|0;
    $27 = $23;
   }
   $26 = (($__n) - ($6))|0;
   __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE21__grow_by_and_replaceEjjjjjjPKc($this,$6,$26,$27,0,$27,$__n,$__s);
  } else {
   if ($10) {
    $13 = ((($this)) + 1|0);
    $14 = $13;
   } else {
    $11 = ((($this)) + 8|0);
    $12 = HEAP32[$11>>2]|0;
    $14 = $12;
   }
   _memmove(($14|0),($__s|0),($__n|0))|0;
   $15 = (($14) + ($__n)|0);
   HEAP8[$15>>0] = 0;
   $16 = HEAP8[$this>>0]|0;
   $17 = $16 & 1;
   $18 = ($17<<24>>24)==(0);
   if ($18) {
    $20 = $__n << 1;
    $21 = $20&255;
    HEAP8[$this>>0] = $21;
    break;
   } else {
    $19 = ((($this)) + 4|0);
    HEAP32[$19>>2] = $__n;
    break;
   }
  }
 } while(0);
 return ($this|0);
}
function __ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE21__grow_by_and_replaceEjjjjjjPKc($this,$__old_cap,$__delta_cap,$__old_sz,$__n_copy,$__n_del,$__n_add,$__p_new_stuff) {
 $this = $this|0;
 $__old_cap = $__old_cap|0;
 $__delta_cap = $__delta_cap|0;
 $__old_sz = $__old_sz|0;
 $__n_copy = $__n_copy|0;
 $__n_del = $__n_del|0;
 $__n_add = $__n_add|0;
 $__p_new_stuff = $__p_new_stuff|0;
 var $$sum = 0, $$sum1 = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (-18 - ($__old_cap))|0;
 $1 = ($0>>>0)<($__delta_cap>>>0);
 if ($1) {
  __ZNKSt3__121__basic_string_commonILb1EE20__throw_length_errorEv($this);
  // unreachable;
 }
 $2 = HEAP8[$this>>0]|0;
 $3 = $2 & 1;
 $4 = ($3<<24>>24)==(0);
 if ($4) {
  $7 = ((($this)) + 1|0);
  $20 = $7;
 } else {
  $5 = ((($this)) + 8|0);
  $6 = HEAP32[$5>>2]|0;
  $20 = $6;
 }
 $8 = ($__old_cap>>>0)<(2147483623);
 if ($8) {
  $9 = (($__delta_cap) + ($__old_cap))|0;
  $10 = $__old_cap << 1;
  $11 = ($9>>>0)<($10>>>0);
  $12 = $11 ? $10 : $9;
  $13 = ($12>>>0)<(11);
  $14 = (($12) + 16)|0;
  $15 = $14 & -16;
  $16 = $13 ? 11 : $15;
  $17 = $16;
 } else {
  $17 = -17;
 }
 $18 = (__Znwj($17)|0);
 $19 = ($__n_copy|0)==(0);
 if (!($19)) {
  _memcpy(($18|0),($20|0),($__n_copy|0))|0;
 }
 $21 = ($__n_add|0)==(0);
 if (!($21)) {
  $22 = (($18) + ($__n_copy)|0);
  _memcpy(($22|0),($__p_new_stuff|0),($__n_add|0))|0;
 }
 $23 = (($__old_sz) - ($__n_del))|0;
 $24 = ($23|0)==($__n_copy|0);
 if (!($24)) {
  $25 = (($23) - ($__n_copy))|0;
  $$sum = (($__n_add) + ($__n_copy))|0;
  $26 = (($18) + ($$sum)|0);
  $$sum1 = (($__n_del) + ($__n_copy))|0;
  $27 = (($20) + ($$sum1)|0);
  _memcpy(($26|0),($27|0),($25|0))|0;
 }
 $28 = ($__old_cap|0)==(10);
 if (!($28)) {
  __ZdlPv($20);
 }
 $29 = ((($this)) + 8|0);
 HEAP32[$29>>2] = $18;
 $30 = $17 | 1;
 HEAP32[$this>>2] = $30;
 $31 = (($23) + ($__n_add))|0;
 $32 = ((($this)) + 4|0);
 HEAP32[$32>>2] = $31;
 $33 = (($18) + ($31)|0);
 HEAP8[$33>>0] = 0;
 return;
}
function runPostSets() {

}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _strlen(ptr) {
    ptr = ptr|0;
    var curr = 0;
    curr = ptr;
    while (((HEAP8[((curr)>>0)])|0)) {
      curr = (curr + 1)|0;
    }
    return (curr - ptr)|0;
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _memmove(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if (((src|0) < (dest|0)) & ((dest|0) < ((src + num)|0))) {
      // Unlikely case: Copy backwards in a safe manner
      ret = dest;
      src = (src + num)|0;
      dest = (dest + num)|0;
      while ((num|0) > 0) {
        dest = (dest - 1)|0;
        src = (src - 1)|0;
        num = (num - 1)|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      }
      dest = ret;
    } else {
      _memcpy(dest, src, num) | 0;
    }
    return dest | 0;
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
  }
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
  }
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
  }
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
  }

// ======== compiled code from system/lib/compiler-rt , see readme therein
function ___muldsi3($a, $b) {
  $a = $a | 0;
  $b = $b | 0;
  var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
  $1 = $a & 65535;
  $2 = $b & 65535;
  $3 = Math_imul($2, $1) | 0;
  $6 = $a >>> 16;
  $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
  $11 = $b >>> 16;
  $12 = Math_imul($11, $1) | 0;
  return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___divdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $7$0 = 0, $7$1 = 0, $8$0 = 0, $10$0 = 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0;
  $7$0 = $2$0 ^ $1$0;
  $7$1 = $2$1 ^ $1$1;
  $8$0 = ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, 0) | 0;
  $10$0 = _i64Subtract($8$0 ^ $7$0, tempRet0 ^ $7$1, $7$0, $7$1) | 0;
  return $10$0 | 0;
}
function ___remdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $10$0 = 0, $10$1 = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 8 | 0;
  $rem = __stackBase__ | 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0, $1$1 ^ $a$1, $1$0, $1$1) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0, $2$1 ^ $b$1, $2$0, $2$1) | 0;
  ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, $rem) | 0;
  $10$0 = _i64Subtract(HEAP32[$rem >> 2] ^ $1$0, HEAP32[$rem + 4 >> 2] ^ $1$1, $1$0, $1$1) | 0;
  $10$1 = tempRet0;
  STACKTOP = __stackBase__;
  return (tempRet0 = $10$1, $10$0) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
  $x_sroa_0_0_extract_trunc = $a$0;
  $y_sroa_0_0_extract_trunc = $b$0;
  $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
  $1$1 = tempRet0;
  $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
  return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0;
  $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
  return $1$0 | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 8 | 0;
  $rem = __stackBase__ | 0;
  ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
  STACKTOP = __stackBase__;
  return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  $rem = $rem | 0;
  var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
  $n_sroa_0_0_extract_trunc = $a$0;
  $n_sroa_1_4_extract_shift$0 = $a$1;
  $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
  $d_sroa_0_0_extract_trunc = $b$0;
  $d_sroa_1_4_extract_shift$0 = $b$1;
  $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
  if (($n_sroa_1_4_extract_trunc | 0) == 0) {
    $4 = ($rem | 0) != 0;
    if (($d_sroa_1_4_extract_trunc | 0) == 0) {
      if ($4) {
        HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
        HEAP32[$rem + 4 >> 2] = 0;
      }
      $_0$1 = 0;
      $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$4) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    }
  }
  $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
  do {
    if (($d_sroa_0_0_extract_trunc | 0) == 0) {
      if ($17) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      if (($n_sroa_0_0_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0;
          HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
      if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
        }
        $_0$1 = 0;
        $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
      $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
      if ($51 >>> 0 <= 30) {
        $57 = $51 + 1 | 0;
        $58 = 31 - $51 | 0;
        $sr_1_ph = $57;
        $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
        $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
        $q_sroa_0_1_ph = 0;
        $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
        break;
      }
      if (($rem | 0) == 0) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = 0 | $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$17) {
        $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($119 >>> 0 <= 31) {
          $125 = $119 + 1 | 0;
          $126 = 31 - $119 | 0;
          $130 = $119 - 31 >> 31;
          $sr_1_ph = $125;
          $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
      if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
        $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
        $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        $89 = 64 - $88 | 0;
        $91 = 32 - $88 | 0;
        $92 = $91 >> 31;
        $95 = $88 - 32 | 0;
        $105 = $95 >> 31;
        $sr_1_ph = $88;
        $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
        $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
        $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
        $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
        break;
      }
      if (($rem | 0) != 0) {
        HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
        HEAP32[$rem + 4 >> 2] = 0;
      }
      if (($d_sroa_0_0_extract_trunc | 0) == 1) {
        $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$0 = 0 | $a$0 & -1;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
        $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
        $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
  } while (0);
  if (($sr_1_ph | 0) == 0) {
    $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
    $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
    $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
    $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = 0;
  } else {
    $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
    $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
    $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
    $137$1 = tempRet0;
    $q_sroa_1_1198 = $q_sroa_1_1_ph;
    $q_sroa_0_1199 = $q_sroa_0_1_ph;
    $r_sroa_1_1200 = $r_sroa_1_1_ph;
    $r_sroa_0_1201 = $r_sroa_0_1_ph;
    $sr_1202 = $sr_1_ph;
    $carry_0203 = 0;
    while (1) {
      $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
      $149 = $carry_0203 | $q_sroa_0_1199 << 1;
      $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
      $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
      _i64Subtract($137$0, $137$1, $r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1) | 0;
      $150$1 = tempRet0;
      $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
      $152 = $151$0 & 1;
      $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0, $r_sroa_0_0_insert_insert42$1, $151$0 & $d_sroa_0_0_insert_insert99$0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1) | 0;
      $r_sroa_0_0_extract_trunc = $154$0;
      $r_sroa_1_4_extract_trunc = tempRet0;
      $155 = $sr_1202 - 1 | 0;
      if (($155 | 0) == 0) {
        break;
      } else {
        $q_sroa_1_1198 = $147;
        $q_sroa_0_1199 = $149;
        $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
        $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
        $sr_1202 = $155;
        $carry_0203 = $152;
      }
    }
    $q_sroa_1_1_lcssa = $147;
    $q_sroa_0_1_lcssa = $149;
    $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
    $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = $152;
  }
  $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
  $q_sroa_0_0_insert_ext75$1 = 0;
  $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
  if (($rem | 0) != 0) {
    HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
    HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
  }
  $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
  $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
}
// =======================================================================



  
function dynCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return FUNCTION_TABLE_iiiiiiii[index&63](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&127](a1|0,a2|0,a3|0)|0;
}


function dynCall_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  FUNCTION_TABLE_viiiiiii[index&127](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0);
}


function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  FUNCTION_TABLE_viiiii[index&63](a1|0,a2|0,a3|0,a4|0,a5|0);
}


function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&255]()|0;
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&255](a1|0);
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&255](a1|0,a2|0);
}


function dynCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return FUNCTION_TABLE_iiiiiii[index&63](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&255](a1|0)|0;
}


function dynCall_viii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  FUNCTION_TABLE_viii[index&255](a1|0,a2|0,a3|0);
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&255]();
}


function dynCall_iiiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return FUNCTION_TABLE_iiiii[index&127](a1|0,a2|0,a3|0,a4|0)|0;
}


function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  FUNCTION_TABLE_viiiiii[index&63](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&255](a1|0,a2|0)|0;
}


function dynCall_viiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  FUNCTION_TABLE_viiii[index&127](a1|0,a2|0,a3|0,a4|0);
}

function b0(p0,p1,p2,p3,p4,p5,p6) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(0);return 0; }
function b1(p0,p1,p2) { p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0; }
function b2(p0,p1,p2,p3,p4,p5,p6) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_viiiiiii(2); }
function b3(p0,p1,p2,p3,p4) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_viiiii(3); }
function b4() { ; nullFunc_i(4);return 0; }
function b5(p0) { p0 = p0|0; nullFunc_vi(5); }
function __emval_decref__wrapper(p0) { p0 = p0|0; __emval_decref(p0|0); }
function b6(p0,p1) { p0 = p0|0;p1 = p1|0; nullFunc_vii(6); }
function b7(p0,p1,p2,p3,p4,p5) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(7);return 0; }
function b8(p0) { p0 = p0|0; nullFunc_ii(8);return 0; }
function b9(p0,p1,p2) { p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_viii(9); }
function b10() { ; nullFunc_v(10); }
function ___cxa_end_catch__wrapper() { ; ___cxa_end_catch(); }
function b11(p0,p1,p2,p3) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(11);return 0; }
function b12(p0,p1,p2,p3,p4,p5) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_viiiiii(12); }
function b13(p0,p1) { p0 = p0|0;p1 = p1|0; nullFunc_iii(13);return 0; }
function b14(p0,p1,p2,p3) { p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_viiii(14); }

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiiiiiii = [b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,__ZN10emscripten8internal7InvokerIP4BillJOiS4_S4_S4_O8BillTypeONSt3__112basic_stringIcNS7_11char_traitsIcEENS7_9allocatorIcEEEEEE6invokeEPFS3_S4_S4_S4_S4_S6_SE_EiiiiS5_PNS0_11BindingTypeISD_EUt_E,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0,b0,b0];
var FUNCTION_TABLE_iiii = [b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,b1,__ZNK10__cxxabiv116__enum_type_info9can_catchEPKNS_16__shim_type_infoERPv,b1,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,b1,b1,b1
,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZN10emscripten8internal7InvokerIP15CredictCardBaseJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEOiEE6invokeEPFS3_SB_SC_EPNS0_11BindingTypeISA_EUt_Ei,b1,b1,b1,b1
,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1
,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEjES2_SB_JjEE6invokeEPSD_PS9_j,__ZN10emscripten8internal12VectorAccessINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3setERS8_jRKS5_,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1
,b1,b1,b1,b1,b1,b1,b1,b1,b1];
var FUNCTION_TABLE_viiiiiii = [b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,__ZN4BillC2Eiiii8BillTypeNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEE,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2,b2,b2,b2,b2];
var FUNCTION_TABLE_viiiii = [b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b3
,b3,b3,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b3,b3,b3,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3];
var FUNCTION_TABLE_i = [b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,__ZN10emscripten8internal12operator_newI14CredictCardMgrJEEEPT_DpOT0_,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,__ZN10emscripten8internal12operator_newINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJEEEPT_DpOT0_,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,___cxa_get_globals_fast,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4];
var FUNCTION_TABLE_vi = [b5,__ZN13CredictCardHND2Ev,__ZN13CredictCardHND0Ev,b5,__ZN13CredictCardYSD2Ev,__ZN13CredictCardYSD0Ev,b5,__ZN18CredictCardHNICashD2Ev,__ZN18CredictCardHNICashD0Ev,b5,__ZN15CredictCardBaseD2Ev,__ZN15CredictCardBaseD0Ev,b5,b5,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,b5,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,b5,__ZN10__cxxabiv116__enum_type_infoD0Ev,b5,__ZN10__cxxabiv117__class_type_infoD0Ev,b5,b5,b5,b5
,__ZN10__cxxabiv120__si_class_type_infoD0Ev,b5,b5,b5,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,b5,b5,b5,__ZN10__cxxabiv119__pointer_type_infoD0Ev,b5,b5,__ZN10emscripten8internal14raw_destructorI4BillEEvPT_,b5,b5,b5,b5,b5,b5,__ZN4Bill4infoEv,b5,b5,b5,b5,__ZN10emscripten8internal14raw_destructorI15CredictCardBaseEEvPT_,b5,b5,b5,b5,b5,b5
,__ZN15CredictCardBase15clearAssignBillEv,b5,b5,__ZN15CredictCardBase19commitCurrentAssignEv,__ZN15CredictCardBase14dumpBestAssignEv,b5,b5,b5,__ZN10emscripten8internal14raw_destructorI13CredictCardHNEEvPT_,b5,b5,b5,b5,__ZN10emscripten8internal14raw_destructorI13CredictCardYSEEvPT_,b5,b5,b5,b5,__ZN10emscripten8internal14raw_destructorI18CredictCardHNICashEEvPT_,b5,b5,b5,__ZN10emscripten8internal14raw_destructorI14CredictCardMgrEEvPT_,b5,b5,b5,b5,b5,b5,__ZN14CredictCardMgr10assignCardEv
,b5,b5,b5,b5,b5,b5,b5,b5,__ZN10emscripten8internal14raw_destructorINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEvPT_,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,__ZN14CredictCardMgrC2Ev,b5,b5,_srand,b5,b5,__emval_decref__wrapper,b5,b5,b5,b5,b5,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5
,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5,b5];
var FUNCTION_TABLE_vii = [b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,__ZN10emscripten8internal13MethodInvokerIM4BillFvvEvPS2_JEE6invokeERKS4_S5_,__ZN15CredictCardBase13_getMergeListERNSt3__16vectorIP4BillNS0_9allocatorIS3_EEEE,b6,b6,b6,b6,b6,b6,__ZN15CredictCardBase16addPreAssignBillEP4Bill,b6,__ZN15CredictCardBase13addAssignBillEP4Bill
,b6,__ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvvEvPS2_JEE6invokeERKS4_S5_,b6,b6,b6,__ZN15CredictCardBase17getBestAssignBillERNSt3__16vectorIP4BillNS0_9allocatorIS3_EEEE,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,__ZN14CredictCardMgr7addCardEP15CredictCardBase,b6,b6
,__ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvvEvPS2_JEE6invokeERKS4_S5_,b6,b6,b6,b6,__ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE9push_backERKS2_,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,__ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE17__annotate_shrinkEj,b6,b6,b6,b6,b6,__ZN13CredictCardHNC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE,b6,b6,b6,__ZN13CredictCardYSC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE
,b6,b6,b6,__ZN18CredictCardHNICashC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEE,b6,b6,__ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS2_RS4_EE,__ZNSt3__16vectorIP15CredictCardBaseNS_9allocatorIS2_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS2_RS4_EE,b6,b6,b6,b6,b6,b6,_abort_message,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6
,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6,b6];
var FUNCTION_TABLE_iiiiiii = [b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,__ZN10emscripten8internal12operator_newI4BillJiiii8BillTypeNSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEEEPT_DpOT0_,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,b7,b7,b7,b7,b7];
var FUNCTION_TABLE_ii = [b8,b8,b8,__ZN13CredictCardHN11getDisCountEv,b8,b8,__ZN13CredictCardYS11getDisCountEv,b8,b8,__ZN18CredictCardHNICash11getDisCountEv,b8,b8,__ZN15CredictCardBase11getDisCountEv,b8,b8,b8,__ZNKSt9bad_alloc4whatEv,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,__ZN10emscripten8internal13getActualTypeI4BillEEPKvPT_,b8,b8,b8,__ZN4Bill9getAmountEv,b8,__ZN4Bill7getTypeEv,b8,b8,b8,b8,__ZN13CredictCardYS9_check699Ev,__ZN10emscripten8internal13getActualTypeI15CredictCardBaseEEPKvPT_,b8,b8,b8,b8,b8,b8,b8
,b8,b8,__ZN15CredictCardBase20getDisCountForCommitEv,b8,b8,b8,b8,__ZN10emscripten8internal13getActualTypeI13CredictCardHNEEPKvPT_,b8,__ZN10emscripten8internal12operator_newI13CredictCardHNJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_,b8,b8,__ZN10emscripten8internal13getActualTypeI13CredictCardYSEEPKvPT_,b8,__ZN10emscripten8internal12operator_newI13CredictCardYSJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_,b8,b8,__ZN10emscripten8internal13getActualTypeI18CredictCardHNICashEEPKvPT_,b8,__ZN10emscripten8internal12operator_newI18CredictCardHNICashJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEEEEPT_DpOT0_,b8,__ZN10emscripten8internal13getActualTypeI14CredictCardMgrEEPKvPT_,b8,b8,__ZN10emscripten8internal7InvokerIP14CredictCardMgrJEE6invokeEPFS3_vE,b8,b8,b8,b8,b8
,b8,__ZN14CredictCardMgr14getMaxDisCountEv,b8,b8,__ZN10emscripten8internal11BindingTypeIP4BillE10toWireTypeES3_,b8,b8,__ZN10emscripten8internal13getActualTypeINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEEEPKvPT_,b8,b8,__ZN10emscripten8internal7InvokerIPNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEJEE6invokeEPFS9_vE,b8,b8,__ZNKSt3__16vectorIP4BillNS_9allocatorIS2_EEE4sizeEv,b8,b8,b8,b8,b8,b8,b8,__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi,__ZN10emscripten8internal11BindingTypeIP15CredictCardBaseE10toWireTypeES3_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerI13CredictCardHNS1_EEPT0_PT_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_13CredictCardHNEEPT0_PT_,b8,__ZN10emscripten8internal11BindingTypeIP13CredictCardHNE10toWireTypeES3_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerI13CredictCardYSS1_EEPT0_PT_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_13CredictCardYSEEPT0_PT_,b8
,__ZN10emscripten8internal11BindingTypeIP13CredictCardYSE10toWireTypeES3_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerI18CredictCardHNICashS1_EEPT0_PT_,__ZN10emscripten4baseI15CredictCardBaseE14convertPointerIS1_18CredictCardHNICashEEPT0_PT_,b8,__ZN10emscripten8internal11BindingTypeIP18CredictCardHNICashE10toWireTypeES3_,b8,b8,b8,b8,b8,__ZN10emscripten8internal11BindingTypeINS_3valEE10toWireTypeERKS2_,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8];
var FUNCTION_TABLE_viii = [b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,__ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvP4BillEvPS2_JS4_EE6invokeERKS6_S7_S4_,b9
,b9,b9,b9,b9,b9,b9,__ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFvRNSt3__16vectorIP4BillNS3_9allocatorIS6_EEEEEvPS2_JSA_EE6invokeERKSC_SD_PS9_,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,__ZN14CredictCardMgr7addBillEP4BillP15CredictCardBase,b9,b9,__ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvP15CredictCardBaseEvPS2_JS4_EE6invokeERKS6_S7_S4_,b9
,b9,b9,b9,b9,b9,b9,__ZNSt3__16vectorIP4BillNS_9allocatorIS2_EEE6resizeEjRKS2_,b9,b9,b9,b9,__ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvRKS5_EvPS8_JSA_EE6invokeERKSC_SD_S5_,b9,b9,b9,b9,b9,b9,b9,b9,__ZN15CredictCardBaseC2ENSt3__112basic_stringIcNS0_11char_traitsIcEENS0_9allocatorIcEEEEi,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,__ZNSt3__114__split_bufferIP4BillRNS_9allocatorIS2_EEE18__construct_at_endEjRKS2_,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9];
var FUNCTION_TABLE_v = [b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,__ZL25default_terminate_handlerv,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b10,___cxa_end_catch__wrapper,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10
,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10];
var FUNCTION_TABLE_iiiii = [b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEjRKS5_EbS9_JjSB_EE6invokeEPSD_PS8_jS5_,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,b11
,b11,b11,b11,b11,b11,b11,b11,b11,b11];
var FUNCTION_TABLE_viiiiii = [b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12
,b12,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12,b12,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12,b12
,b12,b12,b12,b12,b12];
var FUNCTION_TABLE_iii = [b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,__ZN10emscripten8internal13MethodInvokerIM4BillFivEiPS2_JEE6invokeERKS4_S5_,b13,__ZN10emscripten8internal13MethodInvokerIM4BillF8BillTypevES3_PS2_JEE6invokeERKS5_S6_,b13,b13,b13,b13,b13,b13,__ZN10emscripten8internal12operator_newI15CredictCardBaseJNSt3__112basic_stringIcNS3_11char_traitsIcEENS3_9allocatorIcEEEEiEEEPT_DpOT0_,b13,__ZN10emscripten8internal13MethodInvokerIM15CredictCardBaseFivEiPS2_JEE6invokeERKS4_S5_,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,__ZN10emscripten8internal7InvokerIP13CredictCardHNJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E,__ZN10emscripten8internal13MethodInvokerIM13CredictCardHNFivEiPS2_JEE6invokeERKS4_S5_,b13,b13,b13,__ZN10emscripten8internal7InvokerIP13CredictCardYSJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E,__ZN10emscripten8internal13MethodInvokerIM13CredictCardYSFivEiPS2_JEE6invokeERKS4_S5_,b13,b13,b13,__ZN10emscripten8internal7InvokerIP18CredictCardHNICashJONSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEEEE6invokeEPFS3_SB_EPNS0_11BindingTypeISA_EUt_E,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,__ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFivEiPS2_JEE6invokeERKS4_S5_,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,__ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEKFjvEjPKS8_JEE6invokeERKSA_SC_,__ZN10emscripten8internal12VectorAccessINSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEE3getERKS8_j,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,__ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSERKS5_,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13
,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13,b13];
var FUNCTION_TABLE_viiii = [b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi
,b14,b14,b14,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b14,b14,b14,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,__ZN10emscripten8internal13MethodInvokerIM14CredictCardMgrFvP4BillP15CredictCardBaseEvPS2_JS4_S6_EE6invokeERKS8_S9_S4_S6_,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,__ZN10emscripten8internal13MethodInvokerIMNSt3__16vectorIP4BillNS2_9allocatorIS5_EEEEFvjRKS5_EvPS8_JjSA_EE6invokeERKSC_SD_jS5_,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14,b14
,b14,b14,b14,b14,b14,b14,b14,b14,b14];

  return { ___cxa_can_catch: ___cxa_can_catch, _free: _free, ___cxa_is_pointer_type: ___cxa_is_pointer_type, _i64Add: _i64Add, _memmove: _memmove, _strlen: _strlen, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, ___getTypeName: ___getTypeName, _bitshift64Lshr: _bitshift64Lshr, __GLOBAL__sub_I_embind_cpp: __GLOBAL__sub_I_embind_cpp, __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiiiiiii: dynCall_iiiiiiii, dynCall_iiii: dynCall_iiii, dynCall_viiiiiii: dynCall_viiiiiii, dynCall_viiiii: dynCall_viiiii, dynCall_i: dynCall_i, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_iiiiiii: dynCall_iiiiiii, dynCall_ii: dynCall_ii, dynCall_viii: dynCall_viii, dynCall_v: dynCall_v, dynCall_iiiii: dynCall_iiiii, dynCall_viiiiii: dynCall_viiiiii, dynCall_iii: dynCall_iii, dynCall_viiii: dynCall_viiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var real____cxa_can_catch = asm["___cxa_can_catch"]; asm["___cxa_can_catch"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____cxa_can_catch.apply(null, arguments);
};

var real___GLOBAL__sub_I_bind_cpp = asm["__GLOBAL__sub_I_bind_cpp"]; asm["__GLOBAL__sub_I_bind_cpp"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real___GLOBAL__sub_I_bind_cpp.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"]; asm["___cxa_is_pointer_type"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____cxa_is_pointer_type.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__memmove = asm["_memmove"]; asm["_memmove"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__memmove.apply(null, arguments);
};

var real__strlen = asm["_strlen"]; asm["_strlen"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__strlen.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real____getTypeName = asm["___getTypeName"]; asm["___getTypeName"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real____getTypeName.apply(null, arguments);
};

var real___GLOBAL__sub_I_embind_cpp = asm["__GLOBAL__sub_I_embind_cpp"]; asm["__GLOBAL__sub_I_embind_cpp"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real___GLOBAL__sub_I_embind_cpp.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Lshr.apply(null, arguments);
};
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _strlen = Module["_strlen"] = asm["_strlen"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var __GLOBAL__sub_I_embind_cpp = Module["__GLOBAL__sub_I_embind_cpp"] = asm["__GLOBAL__sub_I_embind_cpp"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = asm["dynCall_viiiiiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];


// TODO: strip out parts of this we do not need

//======= begin closure i64 code =======

// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */

var i64Math = (function() { // Emscripten wrapper
  var goog = { math: {} };


  /**
   * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
   * values as *signed* integers.  See the from* functions below for more
   * convenient ways of constructing Longs.
   *
   * The internal representation of a long is the two given signed, 32-bit values.
   * We use 32-bit pieces because these are the size of integers on which
   * Javascript performs bit-operations.  For operations like addition and
   * multiplication, we split each number into 16-bit pieces, which can easily be
   * multiplied within Javascript's floating-point representation without overflow
   * or change in sign.
   *
   * In the algorithms below, we frequently reduce the negative case to the
   * positive case by negating the input(s) and then post-processing the result.
   * Note that we must ALWAYS check specially whether those values are MIN_VALUE
   * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
   * a positive number, it overflows back into a negative).  Not handling this
   * case would often result in infinite recursion.
   *
   * @param {number} low  The low (signed) 32 bits of the long.
   * @param {number} high  The high (signed) 32 bits of the long.
   * @constructor
   */
  goog.math.Long = function(low, high) {
    /**
     * @type {number}
     * @private
     */
    this.low_ = low | 0;  // force into 32 signed bits.

    /**
     * @type {number}
     * @private
     */
    this.high_ = high | 0;  // force into 32 signed bits.
  };


  // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
  // from* methods on which they depend.


  /**
   * A cache of the Long representations of small integer values.
   * @type {!Object}
   * @private
   */
  goog.math.Long.IntCache_ = {};


  /**
   * Returns a Long representing the given (32-bit) integer value.
   * @param {number} value The 32-bit integer in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromInt = function(value) {
    if (-128 <= value && value < 128) {
      var cachedObj = goog.math.Long.IntCache_[value];
      if (cachedObj) {
        return cachedObj;
      }
    }

    var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
    if (-128 <= value && value < 128) {
      goog.math.Long.IntCache_[value] = obj;
    }
    return obj;
  };


  /**
   * Returns a Long representing the given value, provided that it is a finite
   * number.  Otherwise, zero is returned.
   * @param {number} value The number in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromNumber = function(value) {
    if (isNaN(value) || !isFinite(value)) {
      return goog.math.Long.ZERO;
    } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MIN_VALUE;
    } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MAX_VALUE;
    } else if (value < 0) {
      return goog.math.Long.fromNumber(-value).negate();
    } else {
      return new goog.math.Long(
          (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
          (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
    }
  };


  /**
   * Returns a Long representing the 64-bit integer that comes by concatenating
   * the given high and low bits.  Each is assumed to use 32 bits.
   * @param {number} lowBits The low 32-bits.
   * @param {number} highBits The high 32-bits.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromBits = function(lowBits, highBits) {
    return new goog.math.Long(lowBits, highBits);
  };


  /**
   * Returns a Long representation of the given string, written using the given
   * radix.
   * @param {string} str The textual representation of the Long.
   * @param {number=} opt_radix The radix in which the text is written.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromString = function(str, opt_radix) {
    if (str.length == 0) {
      throw Error('number format error: empty string');
    }

    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }

    if (str.charAt(0) == '-') {
      return goog.math.Long.fromString(str.substring(1), radix).negate();
    } else if (str.indexOf('-') >= 0) {
      throw Error('number format error: interior "-" character: ' + str);
    }

    // Do several (8) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));

    var result = goog.math.Long.ZERO;
    for (var i = 0; i < str.length; i += 8) {
      var size = Math.min(8, str.length - i);
      var value = parseInt(str.substring(i, i + size), radix);
      if (size < 8) {
        var power = goog.math.Long.fromNumber(Math.pow(radix, size));
        result = result.multiply(power).add(goog.math.Long.fromNumber(value));
      } else {
        result = result.multiply(radixToPower);
        result = result.add(goog.math.Long.fromNumber(value));
      }
    }
    return result;
  };


  // NOTE: the compiler should inline these constant values below and then remove
  // these variables, so there should be no runtime penalty for these.


  /**
   * Number used repeated below in calculations.  This must appear before the
   * first call to any from* function below.
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_32_DBL_ =
      goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_31_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ / 2;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_48_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_64_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;


  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_63_DBL_ =
      goog.math.Long.TWO_PWR_64_DBL_ / 2;


  /** @type {!goog.math.Long} */
  goog.math.Long.ZERO = goog.math.Long.fromInt(0);


  /** @type {!goog.math.Long} */
  goog.math.Long.ONE = goog.math.Long.fromInt(1);


  /** @type {!goog.math.Long} */
  goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);


  /** @type {!goog.math.Long} */
  goog.math.Long.MAX_VALUE =
      goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);


  /** @type {!goog.math.Long} */
  goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);


  /**
   * @type {!goog.math.Long}
   * @private
   */
  goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);


  /** @return {number} The value, assuming it is a 32-bit integer. */
  goog.math.Long.prototype.toInt = function() {
    return this.low_;
  };


  /** @return {number} The closest floating-point representation to this value. */
  goog.math.Long.prototype.toNumber = function() {
    return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
           this.getLowBitsUnsigned();
  };


  /**
   * @param {number=} opt_radix The radix in which the text should be written.
   * @return {string} The textual representation of this value.
   */
  goog.math.Long.prototype.toString = function(opt_radix) {
    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }

    if (this.isZero()) {
      return '0';
    }

    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        // We need to change the Long value before it can be negated, so we remove
        // the bottom-most digit in this base and then recurse to do the rest.
        var radixLong = goog.math.Long.fromNumber(radix);
        var div = this.div(radixLong);
        var rem = div.multiply(radixLong).subtract(this);
        return div.toString(radix) + rem.toInt().toString(radix);
      } else {
        return '-' + this.negate().toString(radix);
      }
    }

    // Do several (6) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));

    var rem = this;
    var result = '';
    while (true) {
      var remDiv = rem.div(radixToPower);
      var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
      var digits = intval.toString(radix);

      rem = remDiv;
      if (rem.isZero()) {
        return digits + result;
      } else {
        while (digits.length < 6) {
          digits = '0' + digits;
        }
        result = '' + digits + result;
      }
    }
  };


  /** @return {number} The high 32-bits as a signed value. */
  goog.math.Long.prototype.getHighBits = function() {
    return this.high_;
  };


  /** @return {number} The low 32-bits as a signed value. */
  goog.math.Long.prototype.getLowBits = function() {
    return this.low_;
  };


  /** @return {number} The low 32-bits as an unsigned value. */
  goog.math.Long.prototype.getLowBitsUnsigned = function() {
    return (this.low_ >= 0) ?
        this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
  };


  /**
   * @return {number} Returns the number of bits needed to represent the absolute
   *     value of this Long.
   */
  goog.math.Long.prototype.getNumBitsAbs = function() {
    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        return 64;
      } else {
        return this.negate().getNumBitsAbs();
      }
    } else {
      var val = this.high_ != 0 ? this.high_ : this.low_;
      for (var bit = 31; bit > 0; bit--) {
        if ((val & (1 << bit)) != 0) {
          break;
        }
      }
      return this.high_ != 0 ? bit + 33 : bit + 1;
    }
  };


  /** @return {boolean} Whether this value is zero. */
  goog.math.Long.prototype.isZero = function() {
    return this.high_ == 0 && this.low_ == 0;
  };


  /** @return {boolean} Whether this value is negative. */
  goog.math.Long.prototype.isNegative = function() {
    return this.high_ < 0;
  };


  /** @return {boolean} Whether this value is odd. */
  goog.math.Long.prototype.isOdd = function() {
    return (this.low_ & 1) == 1;
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long equals the other.
   */
  goog.math.Long.prototype.equals = function(other) {
    return (this.high_ == other.high_) && (this.low_ == other.low_);
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long does not equal the other.
   */
  goog.math.Long.prototype.notEquals = function(other) {
    return (this.high_ != other.high_) || (this.low_ != other.low_);
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than the other.
   */
  goog.math.Long.prototype.lessThan = function(other) {
    return this.compare(other) < 0;
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than or equal to the other.
   */
  goog.math.Long.prototype.lessThanOrEqual = function(other) {
    return this.compare(other) <= 0;
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than the other.
   */
  goog.math.Long.prototype.greaterThan = function(other) {
    return this.compare(other) > 0;
  };


  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than or equal to the other.
   */
  goog.math.Long.prototype.greaterThanOrEqual = function(other) {
    return this.compare(other) >= 0;
  };


  /**
   * Compares this Long with the given one.
   * @param {goog.math.Long} other Long to compare against.
   * @return {number} 0 if they are the same, 1 if the this is greater, and -1
   *     if the given one is greater.
   */
  goog.math.Long.prototype.compare = function(other) {
    if (this.equals(other)) {
      return 0;
    }

    var thisNeg = this.isNegative();
    var otherNeg = other.isNegative();
    if (thisNeg && !otherNeg) {
      return -1;
    }
    if (!thisNeg && otherNeg) {
      return 1;
    }

    // at this point, the signs are the same, so subtraction will not overflow
    if (this.subtract(other).isNegative()) {
      return -1;
    } else {
      return 1;
    }
  };


  /** @return {!goog.math.Long} The negation of this value. */
  goog.math.Long.prototype.negate = function() {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.MIN_VALUE;
    } else {
      return this.not().add(goog.math.Long.ONE);
    }
  };


  /**
   * Returns the sum of this and the given Long.
   * @param {goog.math.Long} other Long to add to this one.
   * @return {!goog.math.Long} The sum of this and the given Long.
   */
  goog.math.Long.prototype.add = function(other) {
    // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;

    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;

    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 + b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 + b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 + b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 + b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };


  /**
   * Returns the difference of this and the given Long.
   * @param {goog.math.Long} other Long to subtract from this.
   * @return {!goog.math.Long} The difference of this and the given Long.
   */
  goog.math.Long.prototype.subtract = function(other) {
    return this.add(other.negate());
  };


  /**
   * Returns the product of this and the given long.
   * @param {goog.math.Long} other Long to multiply with this.
   * @return {!goog.math.Long} The product of this and the other.
   */
  goog.math.Long.prototype.multiply = function(other) {
    if (this.isZero()) {
      return goog.math.Long.ZERO;
    } else if (other.isZero()) {
      return goog.math.Long.ZERO;
    }

    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    }

    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().multiply(other.negate());
      } else {
        return this.negate().multiply(other).negate();
      }
    } else if (other.isNegative()) {
      return this.multiply(other.negate()).negate();
    }

    // If both longs are small, use float multiplication
    if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
        other.lessThan(goog.math.Long.TWO_PWR_24_)) {
      return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
    }

    // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
    // We can skip products that would overflow.

    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;

    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;

    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };


  /**
   * Returns this Long divided by the given one.
   * @param {goog.math.Long} other Long by which to divide.
   * @return {!goog.math.Long} This Long divided by the given one.
   */
  goog.math.Long.prototype.div = function(other) {
    if (other.isZero()) {
      throw Error('division by zero');
    } else if (this.isZero()) {
      return goog.math.Long.ZERO;
    }

    if (this.equals(goog.math.Long.MIN_VALUE)) {
      if (other.equals(goog.math.Long.ONE) ||
          other.equals(goog.math.Long.NEG_ONE)) {
        return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
      } else if (other.equals(goog.math.Long.MIN_VALUE)) {
        return goog.math.Long.ONE;
      } else {
        // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
        var halfThis = this.shiftRight(1);
        var approx = halfThis.div(other).shiftLeft(1);
        if (approx.equals(goog.math.Long.ZERO)) {
          return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
        } else {
          var rem = this.subtract(other.multiply(approx));
          var result = approx.add(rem.div(other));
          return result;
        }
      }
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ZERO;
    }

    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().div(other.negate());
      } else {
        return this.negate().div(other).negate();
      }
    } else if (other.isNegative()) {
      return this.div(other.negate()).negate();
    }

    // Repeat the following until the remainder is less than other:  find a
    // floating-point that approximates remainder / other *from below*, add this
    // into the result, and subtract it from the remainder.  It is critical that
    // the approximate value is less than or equal to the real value so that the
    // remainder never becomes negative.
    var res = goog.math.Long.ZERO;
    var rem = this;
    while (rem.greaterThanOrEqual(other)) {
      // Approximate the result of division. This may be a little greater or
      // smaller than the actual value.
      var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

      // We will tweak the approximate result by changing it in the 48-th digit or
      // the smallest non-fractional digit, whichever is larger.
      var log2 = Math.ceil(Math.log(approx) / Math.LN2);
      var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

      // Decrease the approximation until it is smaller than the remainder.  Note
      // that if it is too large, the product overflows and is negative.
      var approxRes = goog.math.Long.fromNumber(approx);
      var approxRem = approxRes.multiply(other);
      while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
        approx -= delta;
        approxRes = goog.math.Long.fromNumber(approx);
        approxRem = approxRes.multiply(other);
      }

      // We know the answer can't be zero... and actually, zero would cause
      // infinite recursion since we would make no progress.
      if (approxRes.isZero()) {
        approxRes = goog.math.Long.ONE;
      }

      res = res.add(approxRes);
      rem = rem.subtract(approxRem);
    }
    return res;
  };


  /**
   * Returns this Long modulo the given one.
   * @param {goog.math.Long} other Long by which to mod.
   * @return {!goog.math.Long} This Long modulo the given one.
   */
  goog.math.Long.prototype.modulo = function(other) {
    return this.subtract(this.div(other).multiply(other));
  };


  /** @return {!goog.math.Long} The bitwise-NOT of this value. */
  goog.math.Long.prototype.not = function() {
    return goog.math.Long.fromBits(~this.low_, ~this.high_);
  };


  /**
   * Returns the bitwise-AND of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to AND.
   * @return {!goog.math.Long} The bitwise-AND of this and the other.
   */
  goog.math.Long.prototype.and = function(other) {
    return goog.math.Long.fromBits(this.low_ & other.low_,
                                   this.high_ & other.high_);
  };


  /**
   * Returns the bitwise-OR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to OR.
   * @return {!goog.math.Long} The bitwise-OR of this and the other.
   */
  goog.math.Long.prototype.or = function(other) {
    return goog.math.Long.fromBits(this.low_ | other.low_,
                                   this.high_ | other.high_);
  };


  /**
   * Returns the bitwise-XOR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to XOR.
   * @return {!goog.math.Long} The bitwise-XOR of this and the other.
   */
  goog.math.Long.prototype.xor = function(other) {
    return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                   this.high_ ^ other.high_);
  };


  /**
   * Returns this Long with bits shifted to the left by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the left by the given amount.
   */
  goog.math.Long.prototype.shiftLeft = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var low = this.low_;
      if (numBits < 32) {
        var high = this.high_;
        return goog.math.Long.fromBits(
            low << numBits,
            (high << numBits) | (low >>> (32 - numBits)));
      } else {
        return goog.math.Long.fromBits(0, low << (numBits - 32));
      }
    }
  };


  /**
   * Returns this Long with bits shifted to the right by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount.
   */
  goog.math.Long.prototype.shiftRight = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >> numBits);
      } else {
        return goog.math.Long.fromBits(
            high >> (numBits - 32),
            high >= 0 ? 0 : -1);
      }
    }
  };


  /**
   * Returns this Long with bits shifted to the right by the given amount, with
   * the new top bits matching the current sign bit.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount, with
   *     zeros placed into the new leading bits.
   */
  goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >>> numBits);
      } else if (numBits == 32) {
        return goog.math.Long.fromBits(high, 0);
      } else {
        return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
      }
    }
  };

  //======= begin jsbn =======

  var navigator = { appName: 'Modern Browser' }; // polyfill a little

  // Copyright (c) 2005  Tom Wu
  // All Rights Reserved.
  // http://www-cs-students.stanford.edu/~tjw/jsbn/

  /*
   * Copyright (c) 2003-2005  Tom Wu
   * All Rights Reserved.
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
   * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
   * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
   *
   * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
   * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
   * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
   * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
   * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * In addition, the following condition applies:
   *
   * All redistributions must retain an intact copy of this copyright notice
   * and disclaimer.
   */

  // Basic JavaScript BN library - subset useful for RSA encryption.

  // Bits per digit
  var dbits;

  // JavaScript engine analysis
  var canary = 0xdeadbeefcafe;
  var j_lm = ((canary&0xffffff)==0xefcafe);

  // (public) Constructor
  function BigInteger(a,b,c) {
    if(a != null)
      if("number" == typeof a) this.fromNumber(a,b,c);
      else if(b == null && "string" != typeof a) this.fromString(a,256);
      else this.fromString(a,b);
  }

  // return new, unset BigInteger
  function nbi() { return new BigInteger(null); }

  // am: Compute w_j += (x*this_i), propagate carries,
  // c is initial carry, returns final carry.
  // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
  // We need to select the fastest one that works in this environment.

  // am1: use a single mult and divide to get the high bits,
  // max digit bits should be 26 because
  // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
  function am1(i,x,w,j,c,n) {
    while(--n >= 0) {
      var v = x*this[i++]+w[j]+c;
      c = Math.floor(v/0x4000000);
      w[j++] = v&0x3ffffff;
    }
    return c;
  }
  // am2 avoids a big mult-and-extract completely.
  // Max digit bits should be <= 30 because we do bitwise ops
  // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
  function am2(i,x,w,j,c,n) {
    var xl = x&0x7fff, xh = x>>15;
    while(--n >= 0) {
      var l = this[i]&0x7fff;
      var h = this[i++]>>15;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
      c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
      w[j++] = l&0x3fffffff;
    }
    return c;
  }
  // Alternately, set max digit bits to 28 since some
  // browsers slow down when dealing with 32-bit numbers.
  function am3(i,x,w,j,c,n) {
    var xl = x&0x3fff, xh = x>>14;
    while(--n >= 0) {
      var l = this[i]&0x3fff;
      var h = this[i++]>>14;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x3fff)<<14)+w[j]+c;
      c = (l>>28)+(m>>14)+xh*h;
      w[j++] = l&0xfffffff;
    }
    return c;
  }
  if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
    BigInteger.prototype.am = am2;
    dbits = 30;
  }
  else if(j_lm && (navigator.appName != "Netscape")) {
    BigInteger.prototype.am = am1;
    dbits = 26;
  }
  else { // Mozilla/Netscape seems to prefer am3
    BigInteger.prototype.am = am3;
    dbits = 28;
  }

  BigInteger.prototype.DB = dbits;
  BigInteger.prototype.DM = ((1<<dbits)-1);
  BigInteger.prototype.DV = (1<<dbits);

  var BI_FP = 52;
  BigInteger.prototype.FV = Math.pow(2,BI_FP);
  BigInteger.prototype.F1 = BI_FP-dbits;
  BigInteger.prototype.F2 = 2*dbits-BI_FP;

  // Digit conversions
  var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
  var BI_RC = new Array();
  var rr,vv;
  rr = "0".charCodeAt(0);
  for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
  rr = "a".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
  rr = "A".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

  function int2char(n) { return BI_RM.charAt(n); }
  function intAt(s,i) {
    var c = BI_RC[s.charCodeAt(i)];
    return (c==null)?-1:c;
  }

  // (protected) copy this to r
  function bnpCopyTo(r) {
    for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
    r.t = this.t;
    r.s = this.s;
  }

  // (protected) set from integer value x, -DV <= x < DV
  function bnpFromInt(x) {
    this.t = 1;
    this.s = (x<0)?-1:0;
    if(x > 0) this[0] = x;
    else if(x < -1) this[0] = x+DV;
    else this.t = 0;
  }

  // return bigint initialized to value
  function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

  // (protected) set from string and radix
  function bnpFromString(s,b) {
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 256) k = 8; // byte array
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else { this.fromRadix(s,b); return; }
    this.t = 0;
    this.s = 0;
    var i = s.length, mi = false, sh = 0;
    while(--i >= 0) {
      var x = (k==8)?s[i]&0xff:intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-") mi = true;
        continue;
      }
      mi = false;
      if(sh == 0)
        this[this.t++] = x;
      else if(sh+k > this.DB) {
        this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
        this[this.t++] = (x>>(this.DB-sh));
      }
      else
        this[this.t-1] |= x<<sh;
      sh += k;
      if(sh >= this.DB) sh -= this.DB;
    }
    if(k == 8 && (s[0]&0x80) != 0) {
      this.s = -1;
      if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
    }
    this.clamp();
    if(mi) BigInteger.ZERO.subTo(this,this);
  }

  // (protected) clamp off excess high words
  function bnpClamp() {
    var c = this.s&this.DM;
    while(this.t > 0 && this[this.t-1] == c) --this.t;
  }

  // (public) return string representation in given radix
  function bnToString(b) {
    if(this.s < 0) return "-"+this.negate().toString(b);
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else return this.toRadix(b);
    var km = (1<<k)-1, d, m = false, r = "", i = this.t;
    var p = this.DB-(i*this.DB)%k;
    if(i-- > 0) {
      if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
      while(i >= 0) {
        if(p < k) {
          d = (this[i]&((1<<p)-1))<<(k-p);
          d |= this[--i]>>(p+=this.DB-k);
        }
        else {
          d = (this[i]>>(p-=k))&km;
          if(p <= 0) { p += this.DB; --i; }
        }
        if(d > 0) m = true;
        if(m) r += int2char(d);
      }
    }
    return m?r:"0";
  }

  // (public) -this
  function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

  // (public) |this|
  function bnAbs() { return (this.s<0)?this.negate():this; }

  // (public) return + if this > a, - if this < a, 0 if equal
  function bnCompareTo(a) {
    var r = this.s-a.s;
    if(r != 0) return r;
    var i = this.t;
    r = i-a.t;
    if(r != 0) return (this.s<0)?-r:r;
    while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
    return 0;
  }

  // returns bit length of the integer x
  function nbits(x) {
    var r = 1, t;
    if((t=x>>>16) != 0) { x = t; r += 16; }
    if((t=x>>8) != 0) { x = t; r += 8; }
    if((t=x>>4) != 0) { x = t; r += 4; }
    if((t=x>>2) != 0) { x = t; r += 2; }
    if((t=x>>1) != 0) { x = t; r += 1; }
    return r;
  }

  // (public) return the number of bits in "this"
  function bnBitLength() {
    if(this.t <= 0) return 0;
    return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
  }

  // (protected) r = this << n*DB
  function bnpDLShiftTo(n,r) {
    var i;
    for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
    for(i = n-1; i >= 0; --i) r[i] = 0;
    r.t = this.t+n;
    r.s = this.s;
  }

  // (protected) r = this >> n*DB
  function bnpDRShiftTo(n,r) {
    for(var i = n; i < this.t; ++i) r[i-n] = this[i];
    r.t = Math.max(this.t-n,0);
    r.s = this.s;
  }

  // (protected) r = this << n
  function bnpLShiftTo(n,r) {
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<cbs)-1;
    var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
    for(i = this.t-1; i >= 0; --i) {
      r[i+ds+1] = (this[i]>>cbs)|c;
      c = (this[i]&bm)<<bs;
    }
    for(i = ds-1; i >= 0; --i) r[i] = 0;
    r[ds] = c;
    r.t = this.t+ds+1;
    r.s = this.s;
    r.clamp();
  }

  // (protected) r = this >> n
  function bnpRShiftTo(n,r) {
    r.s = this.s;
    var ds = Math.floor(n/this.DB);
    if(ds >= this.t) { r.t = 0; return; }
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<bs)-1;
    r[0] = this[ds]>>bs;
    for(var i = ds+1; i < this.t; ++i) {
      r[i-ds-1] |= (this[i]&bm)<<cbs;
      r[i-ds] = this[i]>>bs;
    }
    if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
    r.t = this.t-ds;
    r.clamp();
  }

  // (protected) r = this - a
  function bnpSubTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]-a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c -= a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c -= a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c -= a.s;
    }
    r.s = (c<0)?-1:0;
    if(c < -1) r[i++] = this.DV+c;
    else if(c > 0) r[i++] = c;
    r.t = i;
    r.clamp();
  }

  // (protected) r = this * a, r != this,a (HAC 14.12)
  // "this" should be the larger one if appropriate.
  function bnpMultiplyTo(a,r) {
    var x = this.abs(), y = a.abs();
    var i = x.t;
    r.t = i+y.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
    r.s = 0;
    r.clamp();
    if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
  }

  // (protected) r = this^2, r != this (HAC 14.16)
  function bnpSquareTo(r) {
    var x = this.abs();
    var i = r.t = 2*x.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < x.t-1; ++i) {
      var c = x.am(i,x[i],r,2*i,0,1);
      if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
        r[i+x.t] -= x.DV;
        r[i+x.t+1] = 1;
      }
    }
    if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
    r.s = 0;
    r.clamp();
  }

  // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
  // r != q, this != m.  q or r may be null.
  function bnpDivRemTo(m,q,r) {
    var pm = m.abs();
    if(pm.t <= 0) return;
    var pt = this.abs();
    if(pt.t < pm.t) {
      if(q != null) q.fromInt(0);
      if(r != null) this.copyTo(r);
      return;
    }
    if(r == null) r = nbi();
    var y = nbi(), ts = this.s, ms = m.s;
    var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
    if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
    else { pm.copyTo(y); pt.copyTo(r); }
    var ys = y.t;
    var y0 = y[ys-1];
    if(y0 == 0) return;
    var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
    var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
    var i = r.t, j = i-ys, t = (q==null)?nbi():q;
    y.dlShiftTo(j,t);
    if(r.compareTo(t) >= 0) {
      r[r.t++] = 1;
      r.subTo(t,r);
    }
    BigInteger.ONE.dlShiftTo(ys,t);
    t.subTo(y,y);	// "negative" y so we can replace sub with am later
    while(y.t < ys) y[y.t++] = 0;
    while(--j >= 0) {
      // Estimate quotient digit
      var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
      if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
        y.dlShiftTo(j,t);
        r.subTo(t,r);
        while(r[i] < --qd) r.subTo(t,r);
      }
    }
    if(q != null) {
      r.drShiftTo(ys,q);
      if(ts != ms) BigInteger.ZERO.subTo(q,q);
    }
    r.t = ys;
    r.clamp();
    if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
    if(ts < 0) BigInteger.ZERO.subTo(r,r);
  }

  // (public) this mod a
  function bnMod(a) {
    var r = nbi();
    this.abs().divRemTo(a,null,r);
    if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
    return r;
  }

  // Modular reduction using "classic" algorithm
  function Classic(m) { this.m = m; }
  function cConvert(x) {
    if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
    else return x;
  }
  function cRevert(x) { return x; }
  function cReduce(x) { x.divRemTo(this.m,null,x); }
  function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
  function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

  Classic.prototype.convert = cConvert;
  Classic.prototype.revert = cRevert;
  Classic.prototype.reduce = cReduce;
  Classic.prototype.mulTo = cMulTo;
  Classic.prototype.sqrTo = cSqrTo;

  // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
  // justification:
  //         xy == 1 (mod m)
  //         xy =  1+km
  //   xy(2-xy) = (1+km)(1-km)
  // x[y(2-xy)] = 1-k^2m^2
  // x[y(2-xy)] == 1 (mod m^2)
  // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
  // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
  // JS multiply "overflows" differently from C/C++, so care is needed here.
  function bnpInvDigit() {
    if(this.t < 1) return 0;
    var x = this[0];
    if((x&1) == 0) return 0;
    var y = x&3;		// y == 1/x mod 2^2
    y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
    y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
    y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
    // last step - calculate inverse mod DV directly;
    // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
    y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
    // we really want the negative inverse, and -DV < y < DV
    return (y>0)?this.DV-y:-y;
  }

  // Montgomery reduction
  function Montgomery(m) {
    this.m = m;
    this.mp = m.invDigit();
    this.mpl = this.mp&0x7fff;
    this.mph = this.mp>>15;
    this.um = (1<<(m.DB-15))-1;
    this.mt2 = 2*m.t;
  }

  // xR mod m
  function montConvert(x) {
    var r = nbi();
    x.abs().dlShiftTo(this.m.t,r);
    r.divRemTo(this.m,null,r);
    if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
    return r;
  }

  // x/R mod m
  function montRevert(x) {
    var r = nbi();
    x.copyTo(r);
    this.reduce(r);
    return r;
  }

  // x = x/R mod m (HAC 14.32)
  function montReduce(x) {
    while(x.t <= this.mt2)	// pad x so am has enough room later
      x[x.t++] = 0;
    for(var i = 0; i < this.m.t; ++i) {
      // faster way of calculating u0 = x[i]*mp mod DV
      var j = x[i]&0x7fff;
      var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
      // use am to combine the multiply-shift-add into one call
      j = i+this.m.t;
      x[j] += this.m.am(0,u0,x,i,0,this.m.t);
      // propagate carry
      while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
    }
    x.clamp();
    x.drShiftTo(this.m.t,x);
    if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
  }

  // r = "x^2/R mod m"; x != r
  function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

  // r = "xy/R mod m"; x,y != r
  function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

  Montgomery.prototype.convert = montConvert;
  Montgomery.prototype.revert = montRevert;
  Montgomery.prototype.reduce = montReduce;
  Montgomery.prototype.mulTo = montMulTo;
  Montgomery.prototype.sqrTo = montSqrTo;

  // (protected) true iff this is even
  function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

  // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
  function bnpExp(e,z) {
    if(e > 0xffffffff || e < 1) return BigInteger.ONE;
    var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
    g.copyTo(r);
    while(--i >= 0) {
      z.sqrTo(r,r2);
      if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
      else { var t = r; r = r2; r2 = t; }
    }
    return z.revert(r);
  }

  // (public) this^e % m, 0 <= e < 2^32
  function bnModPowInt(e,m) {
    var z;
    if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
    return this.exp(e,z);
  }

  // protected
  BigInteger.prototype.copyTo = bnpCopyTo;
  BigInteger.prototype.fromInt = bnpFromInt;
  BigInteger.prototype.fromString = bnpFromString;
  BigInteger.prototype.clamp = bnpClamp;
  BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
  BigInteger.prototype.drShiftTo = bnpDRShiftTo;
  BigInteger.prototype.lShiftTo = bnpLShiftTo;
  BigInteger.prototype.rShiftTo = bnpRShiftTo;
  BigInteger.prototype.subTo = bnpSubTo;
  BigInteger.prototype.multiplyTo = bnpMultiplyTo;
  BigInteger.prototype.squareTo = bnpSquareTo;
  BigInteger.prototype.divRemTo = bnpDivRemTo;
  BigInteger.prototype.invDigit = bnpInvDigit;
  BigInteger.prototype.isEven = bnpIsEven;
  BigInteger.prototype.exp = bnpExp;

  // public
  BigInteger.prototype.toString = bnToString;
  BigInteger.prototype.negate = bnNegate;
  BigInteger.prototype.abs = bnAbs;
  BigInteger.prototype.compareTo = bnCompareTo;
  BigInteger.prototype.bitLength = bnBitLength;
  BigInteger.prototype.mod = bnMod;
  BigInteger.prototype.modPowInt = bnModPowInt;

  // "constants"
  BigInteger.ZERO = nbv(0);
  BigInteger.ONE = nbv(1);

  // jsbn2 stuff

  // (protected) convert from radix string
  function bnpFromRadix(s,b) {
    this.fromInt(0);
    if(b == null) b = 10;
    var cs = this.chunkSize(b);
    var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
    for(var i = 0; i < s.length; ++i) {
      var x = intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
        continue;
      }
      w = b*w+x;
      if(++j >= cs) {
        this.dMultiply(d);
        this.dAddOffset(w,0);
        j = 0;
        w = 0;
      }
    }
    if(j > 0) {
      this.dMultiply(Math.pow(b,j));
      this.dAddOffset(w,0);
    }
    if(mi) BigInteger.ZERO.subTo(this,this);
  }

  // (protected) return x s.t. r^x < DV
  function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }

  // (public) 0 if this == 0, 1 if this > 0
  function bnSigNum() {
    if(this.s < 0) return -1;
    else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
    else return 1;
  }

  // (protected) this *= n, this >= 0, 1 < n < DV
  function bnpDMultiply(n) {
    this[this.t] = this.am(0,n-1,this,0,0,this.t);
    ++this.t;
    this.clamp();
  }

  // (protected) this += n << w words, this >= 0
  function bnpDAddOffset(n,w) {
    if(n == 0) return;
    while(this.t <= w) this[this.t++] = 0;
    this[w] += n;
    while(this[w] >= this.DV) {
      this[w] -= this.DV;
      if(++w >= this.t) this[this.t++] = 0;
      ++this[w];
    }
  }

  // (protected) convert to radix string
  function bnpToRadix(b) {
    if(b == null) b = 10;
    if(this.signum() == 0 || b < 2 || b > 36) return "0";
    var cs = this.chunkSize(b);
    var a = Math.pow(b,cs);
    var d = nbv(a), y = nbi(), z = nbi(), r = "";
    this.divRemTo(d,y,z);
    while(y.signum() > 0) {
      r = (a+z.intValue()).toString(b).substr(1) + r;
      y.divRemTo(d,y,z);
    }
    return z.intValue().toString(b) + r;
  }

  // (public) return value as integer
  function bnIntValue() {
    if(this.s < 0) {
      if(this.t == 1) return this[0]-this.DV;
      else if(this.t == 0) return -1;
    }
    else if(this.t == 1) return this[0];
    else if(this.t == 0) return 0;
    // assumes 16 < DB < 32
    return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
  }

  // (protected) r = this + a
  function bnpAddTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]+a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c += a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c += a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += a.s;
    }
    r.s = (c<0)?-1:0;
    if(c > 0) r[i++] = c;
    else if(c < -1) r[i++] = this.DV+c;
    r.t = i;
    r.clamp();
  }

  BigInteger.prototype.fromRadix = bnpFromRadix;
  BigInteger.prototype.chunkSize = bnpChunkSize;
  BigInteger.prototype.signum = bnSigNum;
  BigInteger.prototype.dMultiply = bnpDMultiply;
  BigInteger.prototype.dAddOffset = bnpDAddOffset;
  BigInteger.prototype.toRadix = bnpToRadix;
  BigInteger.prototype.intValue = bnIntValue;
  BigInteger.prototype.addTo = bnpAddTo;

  //======= end jsbn =======

  // Emscripten wrapper
  var Wrapper = {
    abs: function(l, h) {
      var x = new goog.math.Long(l, h);
      var ret;
      if (x.isNegative()) {
        ret = x.negate();
      } else {
        ret = x;
      }
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
    },
    ensureTemps: function() {
      if (Wrapper.ensuredTemps) return;
      Wrapper.ensuredTemps = true;
      Wrapper.two32 = new BigInteger();
      Wrapper.two32.fromString('4294967296', 10);
      Wrapper.two64 = new BigInteger();
      Wrapper.two64.fromString('18446744073709551616', 10);
      Wrapper.temp1 = new BigInteger();
      Wrapper.temp2 = new BigInteger();
    },
    lh2bignum: function(l, h) {
      var a = new BigInteger();
      a.fromString(h.toString(), 10);
      var b = new BigInteger();
      a.multiplyTo(Wrapper.two32, b);
      var c = new BigInteger();
      c.fromString(l.toString(), 10);
      var d = new BigInteger();
      c.addTo(b, d);
      return d;
    },
    stringify: function(l, h, unsigned) {
      var ret = new goog.math.Long(l, h).toString();
      if (unsigned && ret[0] == '-') {
        // unsign slowly using jsbn bignums
        Wrapper.ensureTemps();
        var bignum = new BigInteger();
        bignum.fromString(ret, 10);
        ret = new BigInteger();
        Wrapper.two64.addTo(bignum, ret);
        ret = ret.toString(10);
      }
      return ret;
    },
    fromString: function(str, base, min, max, unsigned) {
      Wrapper.ensureTemps();
      var bignum = new BigInteger();
      bignum.fromString(str, base);
      var bigmin = new BigInteger();
      bigmin.fromString(min, 10);
      var bigmax = new BigInteger();
      bigmax.fromString(max, 10);
      if (unsigned && bignum.compareTo(BigInteger.ZERO) < 0) {
        var temp = new BigInteger();
        bignum.addTo(Wrapper.two64, temp);
        bignum = temp;
      }
      var error = false;
      if (bignum.compareTo(bigmin) < 0) {
        bignum = bigmin;
        error = true;
      } else if (bignum.compareTo(bigmax) > 0) {
        bignum = bigmax;
        error = true;
      }
      var ret = goog.math.Long.fromString(bignum.toString()); // min-max checks should have clamped this to a range goog.math.Long can handle well
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
      if (error) throw 'range error';
    }
  };
  return Wrapper;
})();

//======= end closure i64 code =======



// === Auto-generated postamble setup entry stuff ===


function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);

  initialStackTop = STACKTOP;

  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    // Work around a node.js bug where stdout buffer is not flushed at process exit:
    // Instead of process.exit() directly, wait for stdout flush event.
    // See https://github.com/joyent/node/issues/1669 and https://github.com/kripken/emscripten/issues/2582
    // Workaround is based on https://github.com/RReverser/acorn/commit/50ab143cecc9ed71a2d66f78b4aec3bb2e9844f6
    process['stdout']['once']('drain', function () {
      process['exit'](status);
    });
    console.log(' '); // Make sure to print something to force the drain event to occur, in case the stdout buffer was empty.
    // Work around another node bug where sometimes 'drain' is never fired - make another effort
    // to emit the exit status, after a significant delay (if node hasn't fired drain by then, give up)
    setTimeout(function() {
      process['exit'](status);
    }, 500);
  } else
  if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}



