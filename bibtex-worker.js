var Module = {};
var is_browser = typeof self !== "undefined" || typeof window !== "undefined";
if (is_browser) {
 Module["print"] = (function(a) {
  self["postMessage"](JSON.stringify({
   "command": "stdout",
   "contents": a
  }));
 });
 Module["printErr"] = (function(a) {
  self["postMessage"](JSON.stringify({
   "command": "stderr",
   "contents": a
  }));
 });
}
Module["preInit"] = (function() {
 Module["FS_root"] = (function() {
  return FS.root.contents;
 });
});
var FS_createLazyFilesFromList = (function(msg_id, parent, list, parent_url, canRead, canWrite) {
 var xhr = new XMLHttpRequest;
 xhr.open("GET", list, false);
 xhr.responseType = "text";
 xhr.onload = (function() {
  var lines = this.response.split("\n");
  var path, pos, filename;
  for (var i in lines) {
   pos = lines[i].lastIndexOf("/");
   filename = lines[i].slice(pos + 1);
   path = lines[i].slice(0, pos);
   if (filename === ".") Module["FS_createPath"]("/", parent + path, canRead, canWrite); else if (filename.length > 0) Module["FS_createLazyFile"](parent + path, filename, parent_url + path + "/" + filename, canRead, canWrite);
  }
  self["postMessage"](JSON.stringify({
   "command": "result",
   "result": 0,
   "msg_id": msg_id
  }));
 });
 xhr.send();
});
var preparePRNG = (function(argument) {
 if ("egd-pool" in FS.root.contents["dev"].contents) {
  var rand_count = 0;
  var rand_contents = FS.root.contents["dev"].contents["egd-pool"].contents;
  var rand = new Uint8Array(rand_contents);
  FS.createDevice("/dev", "urandom", (function() {
   rand_count++;
   if (rand_count >= rand.length) {
    Module.print("Out of entropy!");
    throw Error("Out of entropy");
   }
   return rand[rand_count - 1];
  }));
  FS.createDevice("/dev", "random", (function() {
   rand_count++;
   if (rand_count >= rand.length) {
    Module.print("Out of entropy!");
    throw Error("Out of entropy");
   }
   return rand[rand_count - 1];
  }));
 }
});
self["onmessage"] = (function(ev) {
 var data = JSON.parse(ev["data"]);
 var args = data["arguments"];
 args = [].concat(args);
 var res = undefined;
 var fn;
 var cmd = data["command"];
 switch (cmd) {
 case "run":
  shouldRunNow = true;
  preparePRNG();
  try {
   res = Module["run"](args);
  } catch (e) {
   self["postMessage"](JSON.stringify({
    "msg_id": data["msg_id"],
    "command": "error",
    "message": e.toString()
   }));
   return;
  }
  self["postMessage"](JSON.stringify({
   "msg_id": data["msg_id"],
   "command": "success",
   "result": res
  }));
  res = undefined;
  break;
 case "FS_createLazyFilesFromList":
  args.unshift(data["msg_id"]);
  res = FS_createLazyFilesFromList.apply(this, args);
  break;
 case "FS_createDataFile":
  FS.createDataFile.apply(FS, args);
  res = true;
  break;
 case "FS_createLazyFile":
  FS.createLazyFile.apply(FS, args);
  res = true;
  break;
 case "FS_createFolder":
  FS.createFolder.apply(FS, args);
  res = true;
  break;
 case "FS_createPath":
  FS.createPath.apply(FS, args);
  res = true;
  break;
 case "FS_unlink":
  FS.unlink.apply(FS, args);
  res = true;
  break;
 case "FS_readFile":
  var tmp = FS.readFile.apply(FS, args);
  var res = "";
  var chunk = 8 * 1024;
  var i;
  for (i = 0; i < tmp.length / chunk; i++) {
   res += String.fromCharCode.apply(null, tmp.subarray(i * chunk, (i + 1) * chunk));
  }
  res += String.fromCharCode.apply(null, tmp.subarray(i * chunk));
  break;
 case "set_TOTAL_MEMORY":
  Module.TOTAL_MEMORY = args[0];
  res = Module.TOTAL_MEMORY;
  break;
 case "test":
  break;
 }
 if (typeof res !== "undefined") self["postMessage"](JSON.stringify({
  "command": "result",
  "result": res,
  "msg_id": data["msg_id"]
 }));
});
var Module;
if (!Module) Module = (typeof Module !== "undefined" ? Module : null) || {};
var moduleOverrides = {};
for (var key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}
var ENVIRONMENT_IS_WEB = typeof window === "object";
var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
var ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (ENVIRONMENT_IS_NODE) {
 if (!Module["print"]) Module["print"] = function print(x) {
  process["stdout"].write(x + "\n");
 };
 if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
  process["stderr"].write(x + "\n");
 };
 var nodeFS = require("fs");
 var nodePath = require("path");
 Module["read"] = function read(filename, binary) {
  filename = nodePath["normalize"](filename);
  var ret = nodeFS["readFileSync"](filename);
  if (!ret && filename != nodePath["resolve"](filename)) {
   filename = path.join(__dirname, "..", "src", filename);
   ret = nodeFS["readFileSync"](filename);
  }
  if (ret && !binary) ret = ret.toString();
  return ret;
 };
 Module["readBinary"] = function readBinary(filename) {
  var ret = Module["read"](filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 Module["load"] = function load(f) {
  globalEval(read(f));
 };
 if (!Module["thisProgram"]) {
  if (process["argv"].length > 1) {
   Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
  } else {
   Module["thisProgram"] = "unknown-program";
  }
 }
 Module["arguments"] = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", (function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 }));
 Module["inspect"] = (function() {
  return "[Emscripten Module object]";
 });
} else if (ENVIRONMENT_IS_SHELL) {
 if (!Module["print"]) Module["print"] = print;
 if (typeof printErr != "undefined") Module["printErr"] = printErr;
 if (typeof read != "undefined") {
  Module["read"] = read;
 } else {
  Module["read"] = function read() {
   throw "no read() available (jsc?)";
  };
 }
 Module["readBinary"] = function readBinary(f) {
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  var data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  Module["arguments"] = scriptArgs;
 } else if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 Module["read"] = function read(url) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
 if (typeof console !== "undefined") {
  if (!Module["print"]) Module["print"] = function print(x) {
   console.log(x);
  };
  if (!Module["printErr"]) Module["printErr"] = function printErr(x) {
   console.log(x);
  };
 } else {
  var TRY_USE_DUMP = false;
  if (!Module["print"]) Module["print"] = TRY_USE_DUMP && typeof dump !== "undefined" ? (function(x) {
   dump(x);
  }) : (function(x) {});
 }
 if (ENVIRONMENT_IS_WORKER) {
  Module["load"] = importScripts;
 }
 if (typeof Module["setWindowTitle"] === "undefined") {
  Module["setWindowTitle"] = (function(title) {
   document.title = title;
  });
 }
} else {
 throw "Unknown runtime environment. Where are we?";
}
function globalEval(x) {
 eval.call(null, x);
}
if (!Module["load"] && Module["read"]) {
 Module["load"] = function load(f) {
  globalEval(Module["read"](f));
 };
}
if (!Module["print"]) {
 Module["print"] = (function() {});
}
if (!Module["printErr"]) {
 Module["printErr"] = Module["print"];
}
if (!Module["arguments"]) {
 Module["arguments"] = [];
}
if (!Module["thisProgram"]) {
 Module["thisProgram"] = "./this.program";
}
Module.print = Module["print"];
Module.printErr = Module["printErr"];
Module["preRun"] = [];
Module["postRun"] = [];
for (var key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}
var Runtime = {
 setTempRet0: (function(value) {
  tempRet0 = value;
 }),
 getTempRet0: (function() {
  return tempRet0;
 }),
 stackSave: (function() {
  return STACKTOP;
 }),
 stackRestore: (function(stackTop) {
  STACKTOP = stackTop;
 }),
 getNativeTypeSize: (function(type) {
  switch (type) {
  case "i1":
  case "i8":
   return 1;
  case "i16":
   return 2;
  case "i32":
   return 4;
  case "i64":
   return 8;
  case "float":
   return 4;
  case "double":
   return 8;
  default:
   {
    if (type[type.length - 1] === "*") {
     return Runtime.QUANTUM_SIZE;
    } else if (type[0] === "i") {
     var bits = parseInt(type.substr(1));
     assert(bits % 8 === 0);
     return bits / 8;
    } else {
     return 0;
    }
   }
  }
 }),
 getNativeFieldSize: (function(type) {
  return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
 }),
 STACK_ALIGN: 16,
 prepVararg: (function(ptr, type) {
  if (type === "double" || type === "i64") {
   if (ptr & 7) {
    assert((ptr & 7) === 4);
    ptr += 4;
   }
  } else {
   assert((ptr & 3) === 0);
  }
  return ptr;
 }),
 getAlignSize: (function(type, size, vararg) {
  if (!vararg && (type == "i64" || type == "double")) return 8;
  if (!type) return Math.min(size, 8);
  return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
 }),
 dynCall: (function(sig, ptr, args) {
  if (args && args.length) {
   if (!args.splice) args = Array.prototype.slice.call(args);
   args.splice(0, 0, ptr);
   return Module["dynCall_" + sig].apply(null, args);
  } else {
   return Module["dynCall_" + sig].call(null, ptr);
  }
 }),
 functionPointers: [],
 addFunction: (function(func) {
  for (var i = 0; i < Runtime.functionPointers.length; i++) {
   if (!Runtime.functionPointers[i]) {
    Runtime.functionPointers[i] = func;
    return 2 * (1 + i);
   }
  }
  throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
 }),
 removeFunction: (function(index) {
  Runtime.functionPointers[(index - 2) / 2] = null;
 }),
 warnOnce: (function(text) {
  if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
  if (!Runtime.warnOnce.shown[text]) {
   Runtime.warnOnce.shown[text] = 1;
   Module.printErr(text);
  }
 }),
 funcWrappers: {},
 getFuncWrapper: (function(func, sig) {
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
 }),
 getCompilerSetting: (function(name) {
  throw "You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";
 }),
 stackAlloc: (function(size) {
  var ret = STACKTOP;
  STACKTOP = STACKTOP + size | 0;
  STACKTOP = STACKTOP + 15 & -16;
  return ret;
 }),
 staticAlloc: (function(size) {
  var ret = STATICTOP;
  STATICTOP = STATICTOP + size | 0;
  STATICTOP = STATICTOP + 15 & -16;
  return ret;
 }),
 dynamicAlloc: (function(size) {
  var ret = DYNAMICTOP;
  DYNAMICTOP = DYNAMICTOP + size | 0;
  DYNAMICTOP = DYNAMICTOP + 15 & -16;
  if (DYNAMICTOP >= TOTAL_MEMORY) {
   var success = enlargeMemory();
   if (!success) {
    DYNAMICTOP = ret;
    return 0;
   }
  }
  return ret;
 }),
 alignMemory: (function(size, quantum) {
  var ret = size = Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16);
  return ret;
 }),
 makeBigInt: (function(low, high, unsigned) {
  var ret = unsigned ? +(low >>> 0) + +(high >>> 0) * +4294967296 : +(low >>> 0) + +(high | 0) * +4294967296;
  return ret;
 }),
 GLOBAL_BASE: 8,
 QUANTUM_SIZE: 4,
 __dummy__: 0
};
Module["Runtime"] = Runtime;
var __THREW__ = 0;
var ABORT = false;
var EXITSTATUS = 0;
var undef = 0;
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD, tempDouble, tempFloat;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;
function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}
var globalScope = this;
function getCFunc(ident) {
 var func = Module["_" + ident];
 if (!func) {
  try {
   func = eval("_" + ident);
  } catch (e) {}
 }
 assert(func, "Cannot call unknown function " + ident + " (perhaps LLVM optimizations or closure removed it?)");
 return func;
}
var cwrap, ccall;
((function() {
 var JSfuncs = {
  "stackSave": (function() {
   Runtime.stackSave();
  }),
  "stackRestore": (function() {
   Runtime.stackRestore();
  }),
  "arrayToC": (function(arr) {
   var ret = Runtime.stackAlloc(arr.length);
   writeArrayToMemory(arr, ret);
   return ret;
  }),
  "stringToC": (function(str) {
   var ret = 0;
   if (str !== null && str !== undefined && str !== 0) {
    ret = Runtime.stackAlloc((str.length << 2) + 1);
    writeStringToMemory(str, ret);
   }
   return ret;
  })
 };
 var toC = {
  "string": JSfuncs["stringToC"],
  "array": JSfuncs["arrayToC"]
 };
 ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
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
  if (returnType === "string") ret = Pointer_stringify(ret);
  if (stack !== 0) {
   if (opts && opts.async) {
    EmterpreterAsync.asyncFinalizers.push((function() {
     Runtime.stackRestore(stack);
    }));
    return;
   }
   Runtime.stackRestore(stack);
  }
  return ret;
 };
 var sourceRegex = /^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
 function parseJSFunc(jsfunc) {
  var parsed = jsfunc.toString().match(sourceRegex).slice(1);
  return {
   arguments: parsed[0],
   body: parsed[1],
   returnValue: parsed[2]
  };
 }
 var JSsource = {};
 for (var fun in JSfuncs) {
  if (JSfuncs.hasOwnProperty(fun)) {
   JSsource[fun] = parseJSFunc(JSfuncs[fun]);
  }
 }
 cwrap = function cwrap(ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  var numericArgs = argTypes.every((function(type) {
   return type === "number";
  }));
  var numericRet = returnType !== "string";
  if (numericRet && numericArgs) {
   return cfunc;
  }
  var argNames = argTypes.map((function(x, i) {
   return "$" + i;
  }));
  var funcstr = "(function(" + argNames.join(",") + ") {";
  var nargs = argTypes.length;
  if (!numericArgs) {
   funcstr += "var stack = " + JSsource["stackSave"].body + ";";
   for (var i = 0; i < nargs; i++) {
    var arg = argNames[i], type = argTypes[i];
    if (type === "number") continue;
    var convertCode = JSsource[type + "ToC"];
    funcstr += "var " + convertCode.arguments + " = " + arg + ";";
    funcstr += convertCode.body + ";";
    funcstr += arg + "=" + convertCode.returnValue + ";";
   }
  }
  var cfuncname = parseJSFunc((function() {
   return cfunc;
  })).returnValue;
  funcstr += "var ret = " + cfuncname + "(" + argNames.join(",") + ");";
  if (!numericRet) {
   var strgfy = parseJSFunc((function() {
    return Pointer_stringify;
   })).returnValue;
   funcstr += "ret = " + strgfy + "(ret);";
  }
  if (!numericArgs) {
   funcstr += JSsource["stackRestore"].body.replace("()", "(stack)") + ";";
  }
  funcstr += "return ret})";
  return eval(funcstr);
 };
}))();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
function setValue(ptr, value, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  HEAP8[ptr >> 0] = value;
  break;
 case "i8":
  HEAP8[ptr >> 0] = value;
  break;
 case "i16":
  HEAP16[ptr >> 1] = value;
  break;
 case "i32":
  HEAP32[ptr >> 2] = value;
  break;
 case "i64":
  tempI64 = [ value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
  break;
 case "float":
  HEAPF32[ptr >> 2] = value;
  break;
 case "double":
  HEAPF64[ptr >> 3] = value;
  break;
 default:
  abort("invalid type for setValue: " + type);
 }
}
Module["setValue"] = setValue;
function getValue(ptr, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  return HEAP8[ptr >> 0];
 case "i8":
  return HEAP8[ptr >> 0];
 case "i16":
  return HEAP16[ptr >> 1];
 case "i32":
  return HEAP32[ptr >> 2];
 case "i64":
  return HEAP32[ptr >> 2];
 case "float":
  return HEAPF32[ptr >> 2];
 case "double":
  return HEAPF64[ptr >> 3];
 default:
  abort("invalid type for setValue: " + type);
 }
 return null;
}
Module["getValue"] = getValue;
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_STATIC = 2;
var ALLOC_DYNAMIC = 3;
var ALLOC_NONE = 4;
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;
function allocate(slab, types, allocator, ptr) {
 var zeroinit, size;
 if (typeof slab === "number") {
  zeroinit = true;
  size = slab;
 } else {
  zeroinit = false;
  size = slab.length;
 }
 var singleType = typeof types === "string" ? types : null;
 var ret;
 if (allocator == ALLOC_NONE) {
  ret = ptr;
 } else {
  ret = [ _malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc ][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
 }
 if (zeroinit) {
  var ptr = ret, stop;
  assert((ret & 3) == 0);
  stop = ret + (size & ~3);
  for (; ptr < stop; ptr += 4) {
   HEAP32[ptr >> 2] = 0;
  }
  stop = ret + size;
  while (ptr < stop) {
   HEAP8[ptr++ >> 0] = 0;
  }
  return ret;
 }
 if (singleType === "i8") {
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
  if (typeof curr === "function") {
   curr = Runtime.getFunctionIndex(curr);
  }
  type = singleType || types[i];
  if (type === 0) {
   i++;
   continue;
  }
  if (type == "i64") type = "i32";
  setValue(ret + i, curr, type);
  if (previousType !== type) {
   typeSize = Runtime.getNativeTypeSize(type);
   previousType = type;
  }
  i += typeSize;
 }
 return ret;
}
Module["allocate"] = allocate;
function getMemory(size) {
 if (!staticSealed) return Runtime.staticAlloc(size);
 if (typeof _sbrk !== "undefined" && !_sbrk.called || !runtimeInitialized) return Runtime.dynamicAlloc(size);
 return _malloc(size);
}
Module["getMemory"] = getMemory;
function Pointer_stringify(ptr, length) {
 if (length === 0 || !ptr) return "";
 var hasUtf = 0;
 var t;
 var i = 0;
 while (1) {
  t = HEAPU8[ptr + i >> 0];
  hasUtf |= t;
  if (t == 0 && !length) break;
  i++;
  if (length && i == length) break;
 }
 if (!length) length = i;
 var ret = "";
 if (hasUtf < 128) {
  var MAX_CHUNK = 1024;
  var curr;
  while (length > 0) {
   curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
   ret = ret ? ret + curr : curr;
   ptr += MAX_CHUNK;
   length -= MAX_CHUNK;
  }
  return ret;
 }
 return Module["UTF8ToString"](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;
function AsciiToString(ptr) {
 var str = "";
 while (1) {
  var ch = HEAP8[ptr++ >> 0];
  if (!ch) return str;
  str += String.fromCharCode(ch);
 }
}
Module["AsciiToString"] = AsciiToString;
function stringToAscii(str, outPtr) {
 return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;
function UTF8ArrayToString(u8Array, idx) {
 var u0, u1, u2, u3, u4, u5;
 var str = "";
 while (1) {
  u0 = u8Array[idx++];
  if (!u0) return str;
  if (!(u0 & 128)) {
   str += String.fromCharCode(u0);
   continue;
  }
  u1 = u8Array[idx++] & 63;
  if ((u0 & 224) == 192) {
   str += String.fromCharCode((u0 & 31) << 6 | u1);
   continue;
  }
  u2 = u8Array[idx++] & 63;
  if ((u0 & 240) == 224) {
   u0 = (u0 & 15) << 12 | u1 << 6 | u2;
  } else {
   u3 = u8Array[idx++] & 63;
   if ((u0 & 248) == 240) {
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3;
   } else {
    u4 = u8Array[idx++] & 63;
    if ((u0 & 252) == 248) {
     u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4;
    } else {
     u5 = u8Array[idx++] & 63;
     u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5;
    }
   }
  }
  if (u0 < 65536) {
   str += String.fromCharCode(u0);
  } else {
   var ch = u0 - 65536;
   str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
  }
 }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;
function UTF8ToString(ptr) {
 return UTF8ArrayToString(HEAPU8, ptr);
}
Module["UTF8ToString"] = UTF8ToString;
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   outU8Array[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   outU8Array[outIdx++] = 192 | u >> 6;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   outU8Array[outIdx++] = 224 | u >> 12;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 2097151) {
   if (outIdx + 3 >= endIdx) break;
   outU8Array[outIdx++] = 240 | u >> 18;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 67108863) {
   if (outIdx + 4 >= endIdx) break;
   outU8Array[outIdx++] = 248 | u >> 24;
   outU8Array[outIdx++] = 128 | u >> 18 & 63;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 5 >= endIdx) break;
   outU8Array[outIdx++] = 252 | u >> 30;
   outU8Array[outIdx++] = 128 | u >> 24 & 63;
   outU8Array[outIdx++] = 128 | u >> 18 & 63;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  }
 }
 outU8Array[outIdx] = 0;
 return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;
function stringToUTF8(str, outPtr, maxBytesToWrite) {
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;
function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) {
   ++len;
  } else if (u <= 2047) {
   len += 2;
  } else if (u <= 65535) {
   len += 3;
  } else if (u <= 2097151) {
   len += 4;
  } else if (u <= 67108863) {
   len += 5;
  } else {
   len += 6;
  }
 }
 return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;
function UTF16ToString(ptr) {
 var i = 0;
 var str = "";
 while (1) {
  var codeUnit = HEAP16[ptr + i * 2 >> 1];
  if (codeUnit == 0) return str;
  ++i;
  str += String.fromCharCode(codeUnit);
 }
}
Module["UTF16ToString"] = UTF16ToString;
function stringToUTF16(str, outPtr, maxBytesToWrite) {
 if (maxBytesToWrite === undefined) {
  maxBytesToWrite = 2147483647;
 }
 if (maxBytesToWrite < 2) return 0;
 maxBytesToWrite -= 2;
 var startPtr = outPtr;
 var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
 for (var i = 0; i < numCharsToWrite; ++i) {
  var codeUnit = str.charCodeAt(i);
  HEAP16[outPtr >> 1] = codeUnit;
  outPtr += 2;
 }
 HEAP16[outPtr >> 1] = 0;
 return outPtr - startPtr;
}
Module["stringToUTF16"] = stringToUTF16;
function lengthBytesUTF16(str) {
 return str.length * 2;
}
Module["lengthBytesUTF16"] = lengthBytesUTF16;
function UTF32ToString(ptr) {
 var i = 0;
 var str = "";
 while (1) {
  var utf32 = HEAP32[ptr + i * 4 >> 2];
  if (utf32 == 0) return str;
  ++i;
  if (utf32 >= 65536) {
   var ch = utf32 - 65536;
   str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
  } else {
   str += String.fromCharCode(utf32);
  }
 }
}
Module["UTF32ToString"] = UTF32ToString;
function stringToUTF32(str, outPtr, maxBytesToWrite) {
 if (maxBytesToWrite === undefined) {
  maxBytesToWrite = 2147483647;
 }
 if (maxBytesToWrite < 4) return 0;
 var startPtr = outPtr;
 var endPtr = startPtr + maxBytesToWrite - 4;
 for (var i = 0; i < str.length; ++i) {
  var codeUnit = str.charCodeAt(i);
  if (codeUnit >= 55296 && codeUnit <= 57343) {
   var trailSurrogate = str.charCodeAt(++i);
   codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
  }
  HEAP32[outPtr >> 2] = codeUnit;
  outPtr += 4;
  if (outPtr + 4 > endPtr) break;
 }
 HEAP32[outPtr >> 2] = 0;
 return outPtr - startPtr;
}
Module["stringToUTF32"] = stringToUTF32;
function lengthBytesUTF32(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var codeUnit = str.charCodeAt(i);
  if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
  len += 4;
 }
 return len;
}
Module["lengthBytesUTF32"] = lengthBytesUTF32;
function demangle(func) {
 var hasLibcxxabi = !!Module["___cxa_demangle"];
 if (hasLibcxxabi) {
  try {
   var buf = _malloc(func.length);
   writeStringToMemory(func.substr(1), buf);
   var status = _malloc(4);
   var ret = Module["___cxa_demangle"](buf, 0, 0, status);
   if (getValue(status, "i32") === 0 && ret) {
    return Pointer_stringify(ret);
   }
  } catch (e) {} finally {
   if (buf) _free(buf);
   if (status) _free(status);
   if (ret) _free(ret);
  }
 }
 var i = 3;
 var basicTypes = {
  "v": "void",
  "b": "bool",
  "c": "char",
  "s": "short",
  "i": "int",
  "l": "long",
  "f": "float",
  "d": "double",
  "w": "wchar_t",
  "a": "signed char",
  "h": "unsigned char",
  "t": "unsigned short",
  "j": "unsigned int",
  "m": "unsigned long",
  "x": "long long",
  "y": "unsigned long long",
  "z": "..."
 };
 var subs = [];
 var first = true;
 function dump(x) {
  if (x) Module.print(x);
  Module.print(func);
  var pre = "";
  for (var a = 0; a < i; a++) pre += " ";
  Module.print(pre + "^");
 }
 function parseNested() {
  i++;
  if (func[i] === "K") i++;
  var parts = [];
  while (func[i] !== "E") {
   if (func[i] === "S") {
    i++;
    var next = func.indexOf("_", i);
    var num = func.substring(i, next) || 0;
    parts.push(subs[num] || "?");
    i = next + 1;
    continue;
   }
   if (func[i] === "C") {
    parts.push(parts[parts.length - 1]);
    i += 2;
    continue;
   }
   var size = parseInt(func.substr(i));
   var pre = size.toString().length;
   if (!size || !pre) {
    i--;
    break;
   }
   var curr = func.substr(i + pre, size);
   parts.push(curr);
   subs.push(curr);
   i += pre + size;
  }
  i++;
  return parts;
 }
 function parse(rawList, limit, allowVoid) {
  limit = limit || Infinity;
  var ret = "", list = [];
  function flushList() {
   return "(" + list.join(", ") + ")";
  }
  var name;
  if (func[i] === "N") {
   name = parseNested().join("::");
   limit--;
   if (limit === 0) return rawList ? [ name ] : name;
  } else {
   if (func[i] === "K" || first && func[i] === "L") i++;
   var size = parseInt(func.substr(i));
   if (size) {
    var pre = size.toString().length;
    name = func.substr(i + pre, size);
    i += pre + size;
   }
  }
  first = false;
  if (func[i] === "I") {
   i++;
   var iList = parse(true);
   var iRet = parse(true, 1, true);
   ret += iRet[0] + " " + name + "<" + iList.join(", ") + ">";
  } else {
   ret = name;
  }
  paramLoop : while (i < func.length && limit-- > 0) {
   var c = func[i++];
   if (c in basicTypes) {
    list.push(basicTypes[c]);
   } else {
    switch (c) {
    case "P":
     list.push(parse(true, 1, true)[0] + "*");
     break;
    case "R":
     list.push(parse(true, 1, true)[0] + "&");
     break;
    case "L":
     {
      i++;
      var end = func.indexOf("E", i);
      var size = end - i;
      list.push(func.substr(i, size));
      i += size + 2;
      break;
     }
    case "A":
     {
      var size = parseInt(func.substr(i));
      i += size.toString().length;
      if (func[i] !== "_") throw "?";
      i++;
      list.push(parse(true, 1, true)[0] + " [" + size + "]");
      break;
     }
    case "E":
     break paramLoop;
    default:
     ret += "?" + c;
     break paramLoop;
    }
   }
  }
  if (!allowVoid && list.length === 1 && list[0] === "void") list = [];
  if (rawList) {
   if (ret) {
    list.push(ret + "?");
   }
   return list;
  } else {
   return ret + flushList();
  }
 }
 var parsed = func;
 try {
  if (func == "Object._main" || func == "_main") {
   return "main()";
  }
  if (typeof func === "number") func = Pointer_stringify(func);
  if (func[0] !== "_") return func;
  if (func[1] !== "_") return func;
  if (func[2] !== "Z") return func;
  switch (func[3]) {
  case "n":
   return "operator new()";
  case "d":
   return "operator delete()";
  }
  parsed = parse();
 } catch (e) {
  parsed += "?";
 }
 if (parsed.indexOf("?") >= 0 && !hasLibcxxabi) {
  Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
 }
 return parsed;
}
function demangleAll(text) {
 return text.replace(/__Z[\w\d_]+/g, (function(x) {
  var y = demangle(x);
  return x === y ? x : x + " [" + y + "]";
 }));
}
function jsStackTrace() {
 var err = new Error;
 if (!err.stack) {
  try {
   throw new Error(0);
  } catch (e) {
   err = e;
  }
  if (!err.stack) {
   return "(no stack trace available)";
  }
 }
 return err.stack.toString();
}
function stackTrace() {
 return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;
var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
 if (x % 4096 > 0) {
  x += 4096 - x % 4096;
 }
 return x;
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false;
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0;
var DYNAMIC_BASE = 0, DYNAMICTOP = 0;
function abortOnCannotGrowMemory() {
 abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
}
function enlargeMemory() {
 abortOnCannotGrowMemory();
}
var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
var totalMemory = 64 * 1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2 * TOTAL_STACK) {
 if (totalMemory < 16 * 1024 * 1024) {
  totalMemory *= 2;
 } else {
  totalMemory += 16 * 1024 * 1024;
 }
}
if (totalMemory !== TOTAL_MEMORY) {
 TOTAL_MEMORY = totalMemory;
}
assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && !!(new Int32Array(1))["subarray"] && !!(new Int32Array(1))["set"], "JS engine does not provide full typed array support");
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
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, "Typed arrays 2 must be run on a little-endian system");
Module["HEAP"] = HEAP;
Module["buffer"] = buffer;
Module["HEAP8"] = HEAP8;
Module["HEAP16"] = HEAP16;
Module["HEAP32"] = HEAP32;
Module["HEAPU8"] = HEAPU8;
Module["HEAPU16"] = HEAPU16;
Module["HEAPU32"] = HEAPU32;
Module["HEAPF32"] = HEAPF32;
Module["HEAPF64"] = HEAPF64;
function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Runtime.dynCall("v", func);
   } else {
    Runtime.dynCall("vi", func, [ callback.arg ]);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
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
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;
function addOnInit(cb) {
 __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;
function addOnPreMain(cb) {
 __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;
function addOnExit(cb) {
 __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;
function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;
function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}
Module["intArrayFromString"] = intArrayFromString;
function intArrayToString(array) {
 var ret = [];
 for (var i = 0; i < array.length; i++) {
  var chr = array[i];
  if (chr > 255) {
   chr &= 255;
  }
  ret.push(String.fromCharCode(chr));
 }
 return ret.join("");
}
Module["intArrayToString"] = intArrayToString;
function writeStringToMemory(string, buffer, dontAddNull) {
 var array = intArrayFromString(string, dontAddNull);
 var i = 0;
 while (i < array.length) {
  var chr = array[i];
  HEAP8[buffer + i >> 0] = chr;
  i = i + 1;
 }
}
Module["writeStringToMemory"] = writeStringToMemory;
function writeArrayToMemory(array, buffer) {
 for (var i = 0; i < array.length; i++) {
  HEAP8[buffer++ >> 0] = array[i];
 }
}
Module["writeArrayToMemory"] = writeArrayToMemory;
function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;
function unSign(value, bits, ignore) {
 if (value >= 0) {
  return value;
 }
 return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value;
}
function reSign(value, bits, ignore) {
 if (value <= 0) {
  return value;
 }
 var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
 if (value >= half && (bits <= 32 || value > half)) {
  value = -2 * half + value;
 }
 return value;
}
if (!Math["imul"] || Math["imul"](4294967295, 5) !== -5) Math["imul"] = function imul(a, b) {
 var ah = a >>> 16;
 var al = a & 65535;
 var bh = b >>> 16;
 var bl = b & 65535;
 return al * bl + (ah * bl + al * bh << 16) | 0;
};
Math.imul = Math["imul"];
if (!Math["clz32"]) Math["clz32"] = (function(x) {
 x = x >>> 0;
 for (var i = 0; i < 32; i++) {
  if (x & 1 << 31 - i) return i;
 }
 return 32;
});
Math.clz32 = Math["clz32"];
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
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function getUniqueRunDependency(id) {
 return id;
}
function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
}
Module["addRunDependency"] = addRunDependency;
function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}
Module["removeRunDependency"] = removeRunDependency;
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var memoryInitializer = null;
var ASM_CONSTS = [];
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 34048;
__ATINIT__.push();
allocate([ 7, 61, 0, 0, 47, 61, 0, 0, 107, 61, 0, 0, 144, 61, 0, 0, 215, 61, 0, 0, 12, 62, 0, 0, 62, 62 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
allocate([ 249, 64, 0, 0, 136, 77, 0, 0, 149, 77, 0, 0, 6, 80, 0, 0, 11, 80, 0, 0, 0, 0, 0, 0, 132, 11 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 2912);
allocate([ 210, 112, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 192, 3, 0, 0, 192, 4, 0, 0, 192, 5, 0, 0, 192, 6, 0, 0, 192, 7, 0, 0, 192, 8, 0, 0, 192, 9, 0, 0, 192, 10, 0, 0, 192, 11, 0, 0, 192, 12, 0, 0, 192, 13, 0, 0, 192, 14, 0, 0, 192, 15, 0, 0, 192, 16, 0, 0, 192, 17, 0, 0, 192, 18, 0, 0, 192, 19, 0, 0, 192, 20, 0, 0, 192, 21, 0, 0, 192, 22, 0, 0, 192, 23, 0, 0, 192, 24, 0, 0, 192, 25, 0, 0, 192, 26, 0, 0, 192, 27, 0, 0, 192, 28, 0, 0, 192, 29, 0, 0, 192, 30, 0, 0, 192, 31, 0, 0, 192, 0, 0, 0, 179, 1, 0, 0, 195, 2, 0, 0, 195, 3, 0, 0, 195, 4, 0, 0, 195, 5, 0, 0, 195, 6, 0, 0, 195, 7, 0, 0, 195, 8, 0, 0, 195, 9, 0, 0, 195, 10, 0, 0, 195, 11, 0, 0, 195, 12, 0, 0, 195, 13, 0, 0, 211, 14, 0, 0, 195, 15, 0, 0, 195, 0, 0, 12, 187, 1, 0, 12, 195, 2, 0, 12, 195, 3, 0, 12, 195, 4, 0, 12, 211, 100, 29, 0, 0, 212, 29, 0, 0, 212, 29, 0, 0, 68, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 237, 126, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 229, 122, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 3, 0, 0, 0, 221, 122, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 7108);
allocate([ 83, 111, 114, 114, 121, 45, 45, 45, 121, 111, 117, 39, 118, 101, 32, 101, 120, 99, 101, 101, 100, 101, 100, 32, 66, 105, 98, 84, 101, 88, 39, 115, 32, 0, 45, 45, 45, 116, 104, 105, 115, 32, 99, 97, 110, 39, 116, 32, 104, 97, 112, 112, 101, 110, 0, 42, 80, 108, 101, 97, 115, 101, 32, 110, 111, 116, 105, 102, 121, 32, 116, 104, 101, 32, 66, 105, 98, 84, 101, 88, 32, 109, 97, 105, 110, 116, 97, 105, 110, 101, 114, 42, 0, 82, 101, 97, 108, 108, 111, 99, 97, 116, 101, 100, 32, 37, 115, 32, 40, 101, 108, 116, 95, 115, 105, 122, 101, 61, 37, 108, 100, 41, 32, 116, 111, 32, 37, 108, 100, 32, 105, 116, 101, 109, 115, 32, 102, 114, 111, 109, 32, 37, 108, 100, 46, 10, 0, 98, 117, 102, 102, 101, 114, 0, 115, 118, 95, 98, 117, 102, 102, 101, 114, 0, 101, 120, 95, 98, 117, 102, 0, 111, 117, 116, 95, 98, 117, 102, 0, 110, 97, 109, 101, 95, 116, 111, 107, 0, 110, 97, 109, 101, 95, 115, 101, 112, 95, 99, 104, 97, 114, 0, 37, 115, 37, 108, 100, 0, 73, 108, 108, 101, 103, 97, 108, 32, 115, 116, 114, 105, 110, 103, 32, 110, 117, 109, 98, 101, 114, 58, 0, 115, 116, 114, 95, 112, 111, 111, 108, 0, 32, 58, 32, 0, 40, 69, 114, 114, 111, 114, 32, 109, 97, 121, 32, 104, 97, 118, 101, 32, 98, 101, 101, 110, 32, 111, 110, 32, 112, 114, 101, 118, 105, 111, 117, 115, 32, 108, 105, 110, 101, 41, 0, 73, 39, 109, 32, 115, 107, 105, 112, 112, 105, 110, 103, 32, 119, 104, 97, 116, 101, 118, 101, 114, 32, 114, 101, 109, 97, 105, 110, 115, 32, 111, 102, 32, 116, 104, 105, 115, 32, 0, 70, 105, 108, 101, 32, 110, 97, 109, 101, 32, 96, 0, 39, 32, 105, 115, 32, 116, 111, 111, 32, 108, 111, 110, 103, 0, 73, 32, 99, 111, 117, 108, 100, 110, 39, 116, 32, 111, 112, 101, 110, 32, 102, 105, 108, 101, 32, 110, 97, 109, 101, 32, 96, 0, 37, 115, 37, 108, 100, 37, 115, 0, 45, 45, 45, 108, 105, 110, 101, 32, 0, 32, 111, 102, 32, 102, 105, 108, 101, 32, 0, 99, 111, 109, 109, 97, 110, 100, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 97, 110, 111, 116, 104, 101, 114, 32, 92, 98, 105, 98, 0, 100, 97, 116, 97, 0, 115, 116, 121, 108, 101, 0, 73, 108, 108, 101, 103, 97, 108, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 32, 99, 111, 109, 109, 97, 110, 100, 0, 37, 115, 37, 99, 37, 99, 0, 78, 111, 32, 34, 0, 83, 116, 117, 102, 102, 32, 97, 102, 116, 101, 114, 32, 34, 0, 87, 104, 105, 116, 101, 32, 115, 112, 97, 99, 101, 32, 105, 110, 32, 97, 114, 103, 117, 109, 101, 110, 116, 0, 67, 105, 116, 101, 32, 104, 97, 115, 104, 32, 101, 114, 114, 111, 114, 0, 99, 105, 116, 101, 95, 108, 105, 115, 116, 0, 116, 121, 112, 101, 95, 108, 105, 115, 116, 0, 101, 110, 116, 114, 121, 95, 101, 120, 105, 115, 116, 115, 0, 99, 105, 116, 101, 95, 105, 110, 102, 111, 0, 73, 32, 102, 111, 117, 110, 100, 32, 110, 111, 32, 0, 45, 45, 45, 119, 104, 105, 108, 101, 32, 114, 101, 97, 100, 105, 110, 103, 32, 102, 105, 108, 101, 32, 0, 45, 45, 108, 105, 110, 101, 32, 0, 73, 108, 108, 101, 103, 97, 108, 32, 101, 110, 100, 32, 111, 102, 32, 115, 116, 121, 108, 101, 32, 102, 105, 108, 101, 32, 105, 110, 32, 99, 111, 109, 109, 97, 110, 100, 58, 32, 0, 85, 110, 107, 110, 111, 119, 110, 32, 102, 117, 110, 99, 116, 105, 111, 110, 32, 99, 108, 97, 115, 115, 0, 98, 117, 105, 108, 116, 45, 105, 110, 0, 119, 105, 122, 97, 114, 100, 45, 100, 101, 102, 105, 110, 101, 100, 0, 105, 110, 116, 101, 103, 101, 114, 45, 108, 105, 116, 101, 114, 97, 108, 0, 115, 116, 114, 105, 110, 103, 45, 108, 105, 116, 101, 114, 97, 108, 0, 102, 105, 101, 108, 100, 0, 105, 110, 116, 101, 103, 101, 114, 45, 101, 110, 116, 114, 121, 45, 118, 97, 114, 105, 97, 98, 108, 101, 0, 115, 116, 114, 105, 110, 103, 45, 101, 110, 116, 114, 121, 45, 118, 97, 114, 105, 97, 98, 108, 101, 0, 105, 110, 116, 101, 103, 101, 114, 45, 103, 108, 111, 98, 97, 108, 45, 118, 97, 114, 105, 97, 98, 108, 101, 0, 115, 116, 114, 105, 110, 103, 45, 103, 108, 111, 98, 97, 108, 45, 118, 97, 114, 105, 97, 98, 108, 101, 0, 73, 100, 101, 110, 116, 105, 102, 105, 101, 114, 32, 115, 99, 97, 110, 110, 105, 110, 103, 32, 101, 114, 114, 111, 114, 0, 37, 99, 37, 99, 37, 115, 0, 34, 32, 98, 101, 103, 105, 110, 115, 32, 105, 100, 101, 110, 116, 105, 102, 105, 101, 114, 44, 32, 99, 111, 109, 109, 97, 110, 100, 58, 32, 0, 34, 32, 105, 109, 109, 101, 100, 105, 97, 116, 101, 108, 121, 32, 102, 111, 108, 108, 111, 119, 115, 32, 105, 100, 101, 110, 116, 105, 102, 105, 101, 114, 44, 32, 99, 111, 109, 109, 97, 110, 100, 58, 32, 0, 34, 32, 105, 115, 32, 109, 105, 115, 115, 105, 110, 103, 32, 105, 110, 32, 99, 111, 109, 109, 97, 110, 100, 58, 32, 0, 32, 105, 115, 32, 97, 108, 114, 101, 97, 100, 121, 32, 97, 32, 116, 121, 112, 101, 32, 34, 0, 34, 32, 102, 117, 110, 99, 116, 105, 111, 110, 32, 110, 97, 109, 101, 0, 101, 110, 116, 114, 121, 0, 102, 105, 101, 108, 100, 95, 105, 110, 102, 111, 0, 73, 108, 108, 101, 103, 97, 108, 32, 101, 110, 100, 32, 111, 102, 32, 100, 97, 116, 97, 98, 97, 115, 101, 32, 102, 105, 108, 101, 0, 37, 115, 37, 99, 37, 115, 37, 99, 37, 99, 0, 73, 32, 119, 97, 115, 32, 101, 120, 112, 101, 99, 116, 105, 110, 103, 32, 97, 32, 96, 0, 39, 32, 111, 114, 32, 97, 32, 96, 0, 73, 32, 119, 97, 115, 32, 101, 120, 112, 101, 99, 116, 105, 110, 103, 32, 97, 110, 32, 34, 0, 85, 110, 98, 97, 108, 97, 110, 99, 101, 100, 32, 98, 114, 97, 99, 101, 115, 0, 89, 111, 117, 114, 32, 102, 105, 101, 108, 100, 32, 105, 115, 32, 109, 111, 114, 101, 32, 116, 104, 97, 110, 32, 0, 32, 99, 104, 97, 114, 97, 99, 116, 101, 114, 115, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 115, 116, 114, 105, 110, 103, 32, 110, 97, 109, 101, 32, 34, 0, 34, 32, 105, 115, 32, 0, 89, 111, 117, 39, 114, 101, 32, 109, 105, 115, 115, 105, 110, 103, 32, 0, 34, 32, 105, 109, 109, 101, 100, 105, 97, 116, 101, 108, 121, 32, 102, 111, 108, 108, 111, 119, 115, 32, 0, 85, 110, 107, 110, 111, 119, 110, 32, 100, 97, 116, 97, 98, 97, 115, 101, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 65, 32, 99, 105, 116, 101, 32, 107, 101, 121, 32, 100, 105, 115, 97, 112, 112, 101, 97, 114, 101, 100, 0, 45, 45, 101, 110, 116, 114, 121, 32, 34, 0, 114, 101, 102, 101, 114, 115, 32, 116, 111, 32, 101, 110, 116, 114, 121, 32, 34, 0, 65, 32, 98, 97, 100, 32, 99, 114, 111, 115, 115, 32, 114, 101, 102, 101, 114, 101, 110, 99, 101, 45, 0, 34, 44, 32, 119, 104, 105, 99, 104, 32, 100, 111, 101, 115, 110, 39, 116, 32, 101, 120, 105, 115, 116, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 73, 32, 100, 105, 100, 110, 39, 116, 32, 102, 105, 110, 100, 32, 97, 32, 100, 97, 116, 97, 98, 97, 115, 101, 32, 101, 110, 116, 114, 121, 32, 102, 111, 114, 32, 34, 0, 32, 102, 111, 114, 32, 101, 110, 116, 114, 121, 32, 0, 119, 104, 105, 108, 101, 32, 101, 120, 101, 99, 117, 116, 105, 110, 103, 45, 0, 119, 104, 105, 108, 101, 32, 101, 120, 101, 99, 117, 116, 105, 110, 103, 0, 89, 111, 117, 32, 99, 97, 110, 39, 116, 32, 109, 101, 115, 115, 32, 119, 105, 116, 104, 32, 101, 110, 116, 114, 105, 101, 115, 32, 104, 101, 114, 101, 0, 73, 108, 108, 101, 103, 97, 108, 32, 108, 105, 116, 101, 114, 97, 108, 32, 116, 121, 112, 101, 0, 85, 110, 107, 110, 111, 119, 110, 32, 108, 105, 116, 101, 114, 97, 108, 32, 116, 121, 112, 101, 0, 37, 108, 100, 37, 115, 0, 32, 105, 115, 32, 97, 110, 32, 105, 110, 116, 101, 103, 101, 114, 32, 108, 105, 116, 101, 114, 97, 108, 0, 34, 32, 105, 115, 32, 97, 32, 115, 116, 114, 105, 110, 103, 32, 108, 105, 116, 101, 114, 97, 108, 0, 39, 32, 105, 115, 32, 97, 32, 102, 117, 110, 99, 116, 105, 111, 110, 32, 108, 105, 116, 101, 114, 97, 108, 0, 39, 32, 105, 115, 32, 97, 32, 109, 105, 115, 115, 105, 110, 103, 32, 102, 105, 101, 108, 100, 0, 37, 108, 100, 10, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 121, 111, 117, 39, 118, 101, 32, 101, 120, 99, 101, 101, 100, 101, 100, 32, 0, 45, 115, 116, 114, 105, 110, 103, 45, 115, 105, 122, 101, 44, 0, 42, 80, 108, 101, 97, 115, 101, 32, 110, 111, 116, 105, 102, 121, 32, 116, 104, 101, 32, 98, 105, 98, 115, 116, 121, 108, 101, 32, 100, 101, 115, 105, 103, 110, 101, 114, 42, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 34, 0, 34, 32, 105, 115, 110, 39, 116, 32, 97, 32, 98, 114, 97, 99, 101, 45, 98, 97, 108, 97, 110, 99, 101, 100, 32, 115, 116, 114, 105, 110, 103, 0, 85, 110, 107, 110, 111, 119, 110, 32, 116, 121, 112, 101, 32, 111, 102, 32, 99, 97, 115, 101, 32, 99, 111, 110, 118, 101, 114, 115, 105, 111, 110, 0, 89, 111, 117, 39, 118, 101, 32, 117, 115, 101, 100, 32, 0, 32, 101, 110, 116, 114, 121, 44, 0, 32, 101, 110, 116, 114, 105, 101, 115, 44, 0, 37, 115, 37, 108, 100, 37, 115, 10, 0, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 32, 119, 105, 122, 95, 100, 101, 102, 105, 110, 101, 100, 45, 102, 117, 110, 99, 116, 105, 111, 110, 32, 108, 111, 99, 97, 116, 105, 111, 110, 115, 44, 0, 37, 115, 37, 108, 100, 37, 115, 37, 108, 100, 37, 115, 10, 0, 32, 115, 116, 114, 105, 110, 103, 115, 32, 119, 105, 116, 104, 32, 0, 32, 99, 104, 97, 114, 97, 99, 116, 101, 114, 115, 44, 0, 97, 110, 100, 32, 116, 104, 101, 32, 98, 117, 105, 108, 116, 95, 105, 110, 32, 102, 117, 110, 99, 116, 105, 111, 110, 45, 99, 97, 108, 108, 32, 99, 111, 117, 110, 116, 115, 44, 32, 0, 32, 105, 110, 32, 97, 108, 108, 44, 32, 97, 114, 101, 58, 0, 37, 115, 37, 108, 100, 10, 0, 32, 45, 45, 32, 0, 110, 117, 109, 98, 101, 114, 32, 111, 102, 32, 115, 116, 114, 105, 110, 103, 115, 32, 0, 104, 97, 115, 104, 32, 115, 105, 122, 101, 32, 0, 68, 117, 112, 108, 105, 99, 97, 116, 101, 32, 115, 111, 114, 116, 32, 107, 101, 121, 0, 46, 97, 117, 120, 32, 32, 32, 32, 32, 32, 32, 32, 0, 46, 98, 98, 108, 32, 32, 32, 32, 32, 32, 32, 32, 0, 46, 98, 108, 103, 32, 32, 32, 32, 32, 32, 32, 32, 0, 46, 98, 115, 116, 32, 32, 32, 32, 32, 32, 32, 32, 0, 46, 98, 105, 98, 32, 32, 32, 32, 32, 32, 32, 32, 0, 116, 101, 120, 105, 110, 112, 117, 116, 115, 58, 32, 32, 0, 116, 101, 120, 98, 105, 98, 58, 32, 32, 32, 32, 32, 0, 92, 99, 105, 116, 97, 116, 105, 111, 110, 32, 32, 32, 0, 92, 98, 105, 98, 100, 97, 116, 97, 32, 32, 32, 32, 0, 92, 98, 105, 98, 115, 116, 121, 108, 101, 32, 32, 32, 0, 92, 64, 105, 110, 112, 117, 116, 32, 32, 32, 32, 32, 0, 101, 110, 116, 114, 121, 32, 32, 32, 32, 32, 32, 32, 0, 101, 120, 101, 99, 117, 116, 101, 32, 32, 32, 32, 32, 0, 102, 117, 110, 99, 116, 105, 111, 110, 32, 32, 32, 32, 0, 105, 110, 116, 101, 103, 101, 114, 115, 32, 32, 32, 32, 0, 105, 116, 101, 114, 97, 116, 101, 32, 32, 32, 32, 32, 0, 109, 97, 99, 114, 111, 32, 32, 32, 32, 32, 32, 32, 0, 114, 101, 97, 100, 32, 32, 32, 32, 32, 32, 32, 32, 0, 114, 101, 118, 101, 114, 115, 101, 32, 32, 32, 32, 32, 0, 115, 111, 114, 116, 32, 32, 32, 32, 32, 32, 32, 32, 0, 115, 116, 114, 105, 110, 103, 115, 32, 32, 32, 32, 32, 0, 99, 111, 109, 109, 101, 110, 116, 32, 32, 32, 32, 32, 0, 112, 114, 101, 97, 109, 98, 108, 101, 32, 32, 32, 32, 0, 115, 116, 114, 105, 110, 103, 32, 32, 32, 32, 32, 32, 0, 61, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 62, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 60, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 43, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 45, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 42, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 58, 61, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 97, 100, 100, 46, 112, 101, 114, 105, 111, 100, 36, 32, 0, 99, 97, 108, 108, 46, 116, 121, 112, 101, 36, 32, 32, 0, 99, 104, 97, 110, 103, 101, 46, 99, 97, 115, 101, 36, 0, 99, 104, 114, 46, 116, 111, 46, 105, 110, 116, 36, 32, 0, 99, 105, 116, 101, 36, 32, 32, 32, 32, 32, 32, 32, 0, 100, 117, 112, 108, 105, 99, 97, 116, 101, 36, 32, 32, 0, 101, 109, 112, 116, 121, 36, 32, 32, 32, 32, 32, 32, 0, 102, 111, 114, 109, 97, 116, 46, 110, 97, 109, 101, 36, 0, 105, 102, 36, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 105, 110, 116, 46, 116, 111, 46, 99, 104, 114, 36, 32, 0, 105, 110, 116, 46, 116, 111, 46, 115, 116, 114, 36, 32, 0, 109, 105, 115, 115, 105, 110, 103, 36, 32, 32, 32, 32, 0, 110, 101, 119, 108, 105, 110, 101, 36, 32, 32, 32, 32, 0, 110, 117, 109, 46, 110, 97, 109, 101, 115, 36, 32, 32, 0, 112, 111, 112, 36, 32, 32, 32, 32, 32, 32, 32, 32, 0, 112, 114, 101, 97, 109, 98, 108, 101, 36, 32, 32, 32, 0, 112, 117, 114, 105, 102, 121, 36, 32, 32, 32, 32, 32, 0, 113, 117, 111, 116, 101, 36, 32, 32, 32, 32, 32, 32, 0, 115, 107, 105, 112, 36, 32, 32, 32, 32, 32, 32, 32, 0, 115, 116, 97, 99, 107, 36, 32, 32, 32, 32, 32, 32, 0, 115, 117, 98, 115, 116, 114, 105, 110, 103, 36, 32, 32, 0, 115, 119, 97, 112, 36, 32, 32, 32, 32, 32, 32, 32, 0, 116, 101, 120, 116, 46, 108, 101, 110, 103, 116, 104, 36, 0, 116, 101, 120, 116, 46, 112, 114, 101, 102, 105, 120, 36, 0, 116, 111, 112, 36, 32, 32, 32, 32, 32, 32, 32, 32, 0, 116, 121, 112, 101, 36, 32, 32, 32, 32, 32, 32, 32, 0, 119, 97, 114, 110, 105, 110, 103, 36, 32, 32, 32, 32, 0, 119, 104, 105, 108, 101, 36, 32, 32, 32, 32, 32, 32, 0, 119, 105, 100, 116, 104, 36, 32, 32, 32, 32, 32, 32, 0, 119, 114, 105, 116, 101, 36, 32, 32, 32, 32, 32, 32, 0, 100, 101, 102, 97, 117, 108, 116, 46, 116, 121, 112, 101, 0, 105, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 106, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 111, 101, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 79, 69, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 97, 101, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 65, 69, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 97, 97, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 65, 65, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 111, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 79, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 108, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 76, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 115, 115, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 99, 114, 111, 115, 115, 114, 101, 102, 32, 32, 32, 32, 0, 115, 111, 114, 116, 46, 107, 101, 121, 36, 32, 32, 32, 0, 101, 110, 116, 114, 121, 46, 109, 97, 120, 36, 32, 32, 0, 103, 108, 111, 98, 97, 108, 46, 109, 97, 120, 36, 32, 0, 67, 117, 114, 115, 101, 32, 121, 111, 117, 44, 32, 119, 105, 122, 97, 114, 100, 44, 32, 98, 101, 102, 111, 114, 101, 32, 121, 111, 117, 32, 114, 101, 99, 117, 114, 115, 101, 32, 109, 101, 58, 0, 102, 117, 110, 99, 116, 105, 111, 110, 32, 0, 32, 105, 115, 32, 105, 108, 108, 101, 103, 97, 108, 32, 105, 110, 32, 105, 116, 115, 32, 111, 119, 110, 32, 100, 101, 102, 105, 110, 105, 116, 105, 111, 110, 0, 32, 105, 115, 32, 97, 110, 32, 117, 110, 107, 110, 111, 119, 110, 32, 102, 117, 110, 99, 116, 105, 111, 110, 0, 34, 32, 99, 97, 110, 39, 116, 32, 102, 111, 108, 108, 111, 119, 32, 97, 32, 108, 105, 116, 101, 114, 97, 108, 0, 102, 117, 110, 99, 116, 105, 111, 110, 0, 73, 108, 108, 101, 103, 97, 108, 32, 105, 110, 116, 101, 103, 101, 114, 32, 105, 110, 32, 105, 110, 116, 101, 103, 101, 114, 32, 108, 105, 116, 101, 114, 97, 108, 0, 115, 105, 110, 103, 108, 95, 102, 117, 110, 99, 116, 105, 111, 110, 0, 37, 115, 37, 99, 37, 115, 0, 78, 111, 32, 96, 0, 39, 32, 116, 111, 32, 101, 110, 100, 32, 115, 116, 114, 105, 110, 103, 32, 108, 105, 116, 101, 114, 97, 108, 0, 65, 108, 114, 101, 97, 100, 121, 32, 101, 110, 99, 111, 117, 110, 116, 101, 114, 101, 100, 32, 105, 109, 112, 108, 105, 99, 105, 116, 32, 102, 117, 110, 99, 116, 105, 111, 110, 0, 119, 105, 122, 95, 102, 117, 110, 99, 116, 105, 111, 110, 115, 0, 65, 32, 100, 105, 103, 105, 116, 32, 100, 105, 115, 97, 112, 112, 101, 97, 114, 101, 100, 0, 97, 32, 102, 105, 101, 108, 100, 32, 112, 97, 114, 116, 0, 117, 115, 101, 100, 32, 105, 110, 32, 105, 116, 115, 32, 111, 119, 110, 32, 100, 101, 102, 105, 110, 105, 116, 105, 111, 110, 0, 117, 110, 100, 101, 102, 105, 110, 101, 100, 0, 102, 105, 101, 108, 100, 95, 105, 110, 102, 111, 32, 105, 110, 100, 101, 120, 32, 105, 115, 32, 111, 117, 116, 32, 111, 102, 32, 114, 97, 110, 103, 101, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 73, 39, 109, 32, 105, 103, 110, 111, 114, 105, 110, 103, 32, 0, 39, 115, 32, 101, 120, 116, 114, 97, 32, 34, 0, 34, 32, 102, 105, 101, 108, 100, 0, 67, 111, 110, 116, 114, 111, 108, 45, 115, 101, 113, 117, 101, 110, 99, 101, 32, 104, 97, 115, 104, 32, 101, 114, 114, 111, 114, 0, 84, 104, 101, 32, 102, 111, 114, 109, 97, 116, 32, 115, 116, 114, 105, 110, 103, 32, 34, 0, 34, 32, 104, 97, 115, 32, 97, 110, 32, 105, 108, 108, 101, 103, 97, 108, 32, 98, 114, 97, 99, 101, 45, 108, 101, 118, 101, 108, 45, 49, 32, 108, 101, 116, 116, 101, 114, 0, 108, 105, 116, 95, 115, 116, 97, 99, 107, 0, 108, 105, 116, 95, 115, 116, 107, 95, 116, 121, 112, 101, 0, 89, 111, 117, 32, 99, 97, 110, 39, 116, 32, 112, 111, 112, 32, 97, 110, 32, 101, 109, 112, 116, 121, 32, 108, 105, 116, 101, 114, 97, 108, 32, 115, 116, 97, 99, 107, 0, 78, 111, 110, 116, 111, 112, 32, 116, 111, 112, 32, 111, 102, 32, 115, 116, 114, 105, 110, 103, 32, 115, 116, 97, 99, 107, 0, 44, 32, 110, 111, 116, 32, 97, 110, 32, 105, 110, 116, 101, 103, 101, 114, 44, 0, 44, 32, 110, 111, 116, 32, 97, 32, 115, 116, 114, 105, 110, 103, 44, 0, 44, 32, 110, 111, 116, 32, 97, 32, 102, 117, 110, 99, 116, 105, 111, 110, 44, 0, 69, 109, 112, 116, 121, 32, 108, 105, 116, 101, 114, 97, 108, 0, 112, 116, 114, 61, 0, 44, 32, 115, 116, 97, 99, 107, 61, 0, 45, 45, 45, 116, 104, 101, 32, 108, 105, 116, 101, 114, 97, 108, 32, 115, 116, 97, 99, 107, 32, 105, 115, 110, 39, 116, 32, 101, 109, 112, 116, 121, 0, 78, 111, 110, 101, 109, 112, 116, 121, 32, 101, 109, 112, 116, 121, 32, 115, 116, 114, 105, 110, 103, 32, 115, 116, 97, 99, 107, 0, 44, 32, 0, 45, 45, 45, 116, 104, 101, 121, 32, 97, 114, 101, 110, 39, 116, 32, 116, 104, 101, 32, 115, 97, 109, 101, 32, 108, 105, 116, 101, 114, 97, 108, 32, 116, 121, 112, 101, 115, 0, 44, 32, 110, 111, 116, 32, 97, 110, 32, 105, 110, 116, 101, 103, 101, 114, 32, 111, 114, 32, 97, 32, 115, 116, 114, 105, 110, 103, 44, 0, 44, 32, 116, 104, 101, 32, 101, 110, 116, 114, 121, 0, 44, 32, 116, 104, 101, 32, 103, 108, 111, 98, 97, 108, 0, 89, 111, 117, 32, 99, 97, 110, 39, 116, 32, 97, 115, 115, 105, 103, 110, 32, 116, 111, 32, 116, 121, 112, 101, 32, 0, 44, 32, 97, 32, 110, 111, 110, 118, 97, 114, 105, 97, 98, 108, 101, 32, 102, 117, 110, 99, 116, 105, 111, 110, 32, 99, 108, 97, 115, 115, 0, 32, 105, 115, 32, 97, 110, 32, 105, 108, 108, 101, 103, 97, 108, 32, 99, 97, 115, 101, 45, 99, 111, 110, 118, 101, 114, 115, 105, 111, 110, 32, 115, 116, 114, 105, 110, 103, 0, 34, 32, 105, 115, 110, 39, 116, 32, 97, 32, 115, 105, 110, 103, 108, 101, 32, 99, 104, 97, 114, 97, 99, 116, 101, 114, 0, 44, 32, 110, 111, 116, 32, 97, 32, 115, 116, 114, 105, 110, 103, 32, 111, 114, 32, 109, 105, 115, 115, 105, 110, 103, 32, 102, 105, 101, 108, 100, 44, 0, 84, 104, 101, 114, 101, 32, 105, 115, 32, 110, 111, 32, 110, 97, 109, 101, 32, 105, 110, 32, 34, 0, 84, 104, 101, 114, 101, 32, 97, 114, 101, 110, 39, 116, 32, 0, 32, 110, 97, 109, 101, 115, 32, 105, 110, 32, 34, 0, 78, 97, 109, 101, 32, 0, 32, 105, 110, 32, 34, 0, 34, 32, 104, 97, 115, 32, 97, 32, 99, 111, 109, 109, 97, 32, 97, 116, 32, 116, 104, 101, 32, 101, 110, 100, 0, 84, 111, 111, 32, 109, 97, 110, 121, 32, 99, 111, 109, 109, 97, 115, 32, 105, 110, 32, 110, 97, 109, 101, 32, 0, 32, 111, 102, 32, 34, 0, 34, 32, 105, 115, 110, 39, 116, 32, 98, 114, 97, 99, 101, 32, 98, 97, 108, 97, 110, 99, 101, 100, 0, 73, 108, 108, 101, 103, 97, 108, 32, 110, 117, 109, 98, 101, 114, 32, 111, 102, 32, 99, 111, 109, 109, 97, 44, 115, 0, 32, 105, 115, 110, 39, 116, 32, 118, 97, 108, 105, 100, 32, 65, 83, 67, 73, 73, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 0, 85, 110, 107, 110, 111, 119, 110, 32, 98, 117, 105, 108, 116, 45, 105, 110, 32, 102, 117, 110, 99, 116, 105, 111, 110, 0, 114, 98, 0, 65, 108, 114, 101, 97, 100, 121, 32, 101, 110, 99, 111, 117, 110, 116, 101, 114, 101, 100, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 32, 102, 105, 108, 101, 0, 116, 101, 114, 115, 101, 0, 109, 105, 110, 45, 99, 114, 111, 115, 115, 114, 101, 102, 115, 0, 104, 101, 108, 112, 0, 118, 101, 114, 115, 105, 111, 110, 0, 98, 105, 98, 116, 101, 120, 0, 84, 104, 105, 115, 32, 105, 115, 32, 66, 105, 98, 84, 101, 88, 44, 32, 86, 101, 114, 115, 105, 111, 110, 32, 48, 46, 57, 57, 100, 0, 79, 114, 101, 110, 32, 80, 97, 116, 97, 115, 104, 110, 105, 107, 0, 37, 115, 37, 115, 10, 0, 58, 32, 78, 101, 101, 100, 32, 101, 120, 97, 99, 116, 108, 121, 32, 111, 110, 101, 32, 102, 105, 108, 101, 32, 97, 114, 103, 117, 109, 101, 110, 116, 46, 0, 98, 105, 98, 95, 108, 105, 115, 116, 0, 98, 105, 98, 95, 102, 105, 108, 101, 0, 115, 95, 112, 114, 101, 97, 109, 98, 108, 101, 0, 84, 104, 105, 115, 32, 100, 97, 116, 97, 98, 97, 115, 101, 32, 102, 105, 108, 101, 32, 97, 112, 112, 101, 97, 114, 115, 32, 109, 111, 114, 101, 32, 116, 104, 97, 110, 32, 111, 110, 99, 101, 58, 32, 0, 73, 32, 99, 111, 117, 108, 100, 110, 39, 116, 32, 111, 112, 101, 110, 32, 100, 97, 116, 97, 98, 97, 115, 101, 32, 102, 105, 108, 101, 32, 0, 65, 108, 114, 101, 97, 100, 121, 32, 101, 110, 99, 111, 117, 110, 116, 101, 114, 101, 100, 32, 115, 116, 121, 108, 101, 32, 102, 105, 108, 101, 0, 73, 32, 99, 111, 117, 108, 100, 110, 39, 116, 32, 111, 112, 101, 110, 32, 115, 116, 121, 108, 101, 32, 102, 105, 108, 101, 32, 0, 84, 104, 101, 32, 115, 116, 121, 108, 101, 32, 102, 105, 108, 101, 58, 32, 0, 77, 117, 108, 116, 105, 112, 108, 101, 32, 105, 110, 99, 108, 117, 115, 105, 111, 110, 115, 32, 111, 102, 32, 101, 110, 116, 105, 114, 101, 32, 100, 97, 116, 97, 98, 97, 115, 101, 0, 67, 97, 115, 101, 32, 109, 105, 115, 109, 97, 116, 99, 104, 32, 101, 114, 114, 111, 114, 32, 98, 101, 116, 119, 101, 101, 110, 32, 99, 105, 116, 101, 32, 107, 101, 121, 115, 32, 0, 32, 97, 110, 100, 32, 0, 58, 32, 0, 97, 117, 120, 105, 108, 105, 97, 114, 121, 32, 102, 105, 108, 101, 32, 100, 101, 112, 116, 104, 32, 0, 32, 104, 97, 115, 32, 97, 32, 119, 114, 111, 110, 103, 32, 101, 120, 116, 101, 110, 115, 105, 111, 110, 0, 65, 108, 114, 101, 97, 100, 121, 32, 101, 110, 99, 111, 117, 110, 116, 101, 114, 101, 100, 32, 102, 105, 108, 101, 32, 0, 73, 32, 99, 111, 117, 108, 100, 110, 39, 116, 32, 111, 112, 101, 110, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 32, 102, 105, 108, 101, 32, 0, 65, 32, 108, 101, 118, 101, 108, 45, 0, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 32, 102, 105, 108, 101, 58, 32, 0, 85, 110, 107, 110, 111, 119, 110, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 92, 99, 105, 116, 97, 116, 105, 111, 110, 32, 99, 111, 109, 109, 97, 110, 100, 115, 0, 99, 105, 116, 101, 32, 107, 101, 121, 115, 0, 92, 98, 105, 98, 100, 97, 116, 97, 32, 99, 111, 109, 109, 97, 110, 100, 0, 100, 97, 116, 97, 98, 97, 115, 101, 32, 102, 105, 108, 101, 115, 0, 92, 98, 105, 98, 115, 116, 121, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 115, 116, 121, 108, 101, 32, 102, 105, 108, 101, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 97, 110, 111, 116, 104, 101, 114, 32, 101, 110, 116, 114, 121, 32, 99, 111, 109, 109, 97, 110, 100, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 73, 32, 100, 105, 100, 110, 39, 116, 32, 102, 105, 110, 100, 32, 97, 110, 121, 32, 102, 105, 101, 108, 100, 115, 0, 32, 104, 97, 115, 32, 98, 97, 100, 32, 102, 117, 110, 99, 116, 105, 111, 110, 32, 116, 121, 112, 101, 32, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 101, 120, 101, 99, 117, 116, 101, 32, 99, 111, 109, 109, 97, 110, 100, 32, 98, 101, 102, 111, 114, 101, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 101, 120, 101, 99, 117, 116, 101, 0, 105, 110, 116, 101, 103, 101, 114, 115, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 105, 116, 101, 114, 97, 116, 101, 32, 99, 111, 109, 109, 97, 110, 100, 32, 98, 101, 102, 111, 114, 101, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 105, 116, 101, 114, 97, 116, 101, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 109, 97, 99, 114, 111, 32, 99, 111, 109, 109, 97, 110, 100, 32, 97, 102, 116, 101, 114, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 109, 97, 99, 114, 111, 0, 32, 105, 115, 32, 97, 108, 114, 101, 97, 100, 121, 32, 100, 101, 102, 105, 110, 101, 100, 32, 97, 115, 32, 97, 32, 109, 97, 99, 114, 111, 0, 65, 32, 109, 97, 99, 114, 111, 32, 100, 101, 102, 105, 110, 105, 116, 105, 111, 110, 32, 109, 117, 115, 116, 32, 98, 101, 32, 0, 45, 100, 101, 108, 105, 109, 105, 116, 101, 100, 0, 84, 104, 101, 114, 101, 39, 115, 32, 110, 111, 32, 96, 0, 39, 32, 116, 111, 32, 101, 110, 100, 32, 109, 97, 99, 114, 111, 32, 100, 101, 102, 105, 110, 105, 116, 105, 111, 110, 0, 65, 110, 32, 34, 0, 34, 32, 100, 105, 115, 97, 112, 112, 101, 97, 114, 101, 100, 0, 97, 110, 32, 101, 110, 116, 114, 121, 32, 116, 121, 112, 101, 0, 77, 105, 115, 115, 105, 110, 103, 32, 34, 0, 34, 32, 105, 110, 32, 112, 114, 101, 97, 109, 98, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 97, 32, 115, 116, 114, 105, 110, 103, 32, 110, 97, 109, 101, 0, 34, 32, 105, 110, 32, 115, 116, 114, 105, 110, 103, 32, 99, 111, 109, 109, 97, 110, 100, 0, 84, 104, 101, 32, 99, 105, 116, 101, 32, 108, 105, 115, 116, 32, 105, 115, 32, 109, 101, 115, 115, 101, 100, 32, 117, 112, 0, 82, 101, 112, 101, 97, 116, 101, 100, 32, 101, 110, 116, 114, 121, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 101, 110, 116, 114, 121, 32, 116, 121, 112, 101, 32, 102, 111, 114, 32, 34, 0, 34, 32, 105, 115, 110, 39, 116, 32, 115, 116, 121, 108, 101, 45, 102, 105, 108, 101, 32, 100, 101, 102, 105, 110, 101, 100, 0, 97, 32, 102, 105, 101, 108, 100, 32, 110, 97, 109, 101, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 97, 110, 111, 116, 104, 101, 114, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 32, 98, 101, 102, 111, 114, 101, 32, 101, 110, 116, 114, 121, 32, 99, 111, 109, 109, 97, 110, 100, 0, 68, 97, 116, 97, 98, 97, 115, 101, 32, 102, 105, 108, 101, 32, 35, 0, 87, 97, 114, 110, 105, 110, 103, 45, 45, 121, 111, 117, 39, 118, 101, 32, 110, 101, 115, 116, 101, 100, 32, 99, 114, 111, 115, 115, 32, 114, 101, 102, 101, 114, 101, 110, 99, 101, 115, 0, 34, 44, 32, 119, 104, 105, 99, 104, 32, 97, 108, 115, 111, 32, 114, 101, 102, 101, 114, 115, 32, 116, 111, 32, 115, 111, 109, 101, 116, 104, 105, 110, 103, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 114, 101, 118, 101, 114, 115, 101, 32, 99, 111, 109, 109, 97, 110, 100, 32, 98, 101, 102, 111, 114, 101, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 114, 101, 118, 101, 114, 115, 101, 0, 73, 108, 108, 101, 103, 97, 108, 44, 32, 115, 111, 114, 116, 32, 99, 111, 109, 109, 97, 110, 100, 32, 98, 101, 102, 111, 114, 101, 32, 114, 101, 97, 100, 32, 99, 111, 109, 109, 97, 110, 100, 0, 115, 116, 114, 105, 110, 103, 115, 0, 103, 108, 98, 95, 115, 116, 114, 95, 112, 116, 114, 0, 103, 108, 111, 98, 97, 108, 95, 115, 116, 114, 115, 0, 103, 108, 98, 95, 115, 116, 114, 95, 101, 110, 100, 0, 34, 32, 99, 97, 110, 39, 116, 32, 115, 116, 97, 114, 116, 32, 97, 32, 115, 116, 121, 108, 101, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 32, 105, 115, 32, 97, 110, 32, 105, 108, 108, 101, 103, 97, 108, 32, 115, 116, 121, 108, 101, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 85, 110, 107, 110, 111, 119, 110, 32, 115, 116, 121, 108, 101, 45, 102, 105, 108, 101, 32, 99, 111, 109, 109, 97, 110, 100, 0, 101, 110, 116, 95, 115, 116, 114, 95, 115, 105, 122, 101, 0, 103, 108, 111, 98, 95, 115, 116, 114, 95, 115, 105, 122, 101, 0, 109, 97, 120, 95, 115, 116, 114, 105, 110, 103, 115, 0, 37, 108, 100, 37, 115, 10, 0, 32, 105, 115, 32, 97, 32, 98, 97, 100, 32, 98, 97, 100, 0, 37, 115, 37, 108, 100, 37, 115, 37, 108, 100, 37, 115, 37, 108, 100, 10, 0, 67, 97, 112, 97, 99, 105, 116, 121, 58, 32, 109, 97, 120, 95, 115, 116, 114, 105, 110, 103, 115, 61, 0, 44, 32, 104, 97, 115, 104, 95, 115, 105, 122, 101, 61, 0, 44, 32, 104, 97, 115, 104, 95, 112, 114, 105, 109, 101, 61, 0, 84, 104, 101, 32, 116, 111, 112, 45, 108, 101, 118, 101, 108, 32, 97, 117, 120, 105, 108, 105, 97, 114, 121, 32, 102, 105, 108, 101, 58, 32, 0, 65, 98, 111, 114, 116, 101, 100, 32, 97, 116, 32, 108, 105, 110, 101, 32, 0, 40, 84, 104, 101, 114, 101, 32, 119, 97, 115, 32, 49, 32, 119, 97, 114, 110, 105, 110, 103, 41, 0, 40, 84, 104, 101, 114, 101, 32, 119, 101, 114, 101, 32, 0, 32, 119, 97, 114, 110, 105, 110, 103, 115, 41, 0, 40, 84, 104, 101, 114, 101, 32, 119, 97, 115, 32, 49, 32, 101, 114, 114, 111, 114, 32, 109, 101, 115, 115, 97, 103, 101, 41, 0, 32, 101, 114, 114, 111, 114, 32, 109, 101, 115, 115, 97, 103, 101, 115, 41, 0, 40, 84, 104, 97, 116, 32, 119, 97, 115, 32, 97, 32, 102, 97, 116, 97, 108, 32, 101, 114, 114, 111, 114, 41, 0, 72, 105, 115, 116, 111, 114, 121, 32, 105, 115, 32, 98, 117, 110, 107, 0, 85, 115, 97, 103, 101, 58, 32, 98, 105, 98, 116, 101, 120, 32, 91, 79, 80, 84, 73, 79, 78, 93, 46, 46, 46, 32, 65, 85, 88, 70, 73, 76, 69, 91, 46, 97, 117, 120, 93, 0, 32, 32, 87, 114, 105, 116, 101, 32, 98, 105, 98, 108, 105, 111, 103, 114, 97, 112, 104, 121, 32, 102, 111, 114, 32, 101, 110, 116, 114, 105, 101, 115, 32, 105, 110, 32, 65, 85, 88, 70, 73, 76, 69, 32, 116, 111, 32, 65, 85, 88, 70, 73, 76, 69, 46, 98, 98, 108, 44, 0, 32, 32, 97, 108, 111, 110, 103, 32, 119, 105, 116, 104, 32, 97, 32, 108, 111, 103, 32, 102, 105, 108, 101, 32, 65, 85, 88, 70, 73, 76, 69, 46, 98, 108, 103, 46, 0, 45, 109, 105, 110, 45, 99, 114, 111, 115, 115, 114, 101, 102, 115, 61, 78, 85, 77, 66, 69, 82, 32, 32, 105, 110, 99, 108, 117, 100, 101, 32, 105, 116, 101, 109, 32, 97, 102, 116, 101, 114, 32, 78, 85, 77, 66, 69, 82, 32, 99, 114, 111, 115, 115, 45, 114, 101, 102, 115, 59, 32, 100, 101, 102, 97, 117, 108, 116, 32, 50, 0, 45, 116, 101, 114, 115, 101, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 100, 111, 32, 110, 111, 116, 32, 112, 114, 105, 110, 116, 32, 112, 114, 111, 103, 114, 101, 115, 115, 32, 114, 101, 112, 111, 114, 116, 115, 0, 45, 104, 101, 108, 112, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 100, 105, 115, 112, 108, 97, 121, 32, 116, 104, 105, 115, 32, 104, 101, 108, 112, 32, 97, 110, 100, 32, 101, 120, 105, 116, 0, 45, 118, 101, 114, 115, 105, 111, 110, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 111, 117, 116, 112, 117, 116, 32, 118, 101, 114, 115, 105, 111, 110, 32, 105, 110, 102, 111, 114, 109, 97, 116, 105, 111, 110, 32, 97, 110, 100, 32, 101, 120, 105, 116, 0, 37, 115, 58, 32, 79, 111, 112, 115, 59, 32, 110, 111, 116, 32, 101, 110, 111, 117, 103, 104, 32, 97, 114, 103, 117, 109, 101, 110, 116, 115, 46, 10, 0, 73, 78, 80, 85, 84, 0, 79, 85, 84, 80, 85, 84, 0, 102, 99, 108, 111, 115, 101, 0, 37, 115, 32, 37, 115, 10, 0, 46, 102, 108, 115, 0, 119, 98, 0, 80, 87, 68, 32, 37, 115, 10, 0, 112, 114, 111, 103, 95, 110, 97, 109, 101, 95, 101, 110, 100, 32, 38, 38, 32, 112, 114, 111, 103, 95, 118, 101, 114, 115, 105, 111, 110, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 119, 101, 98, 50, 99, 47, 108, 105, 98, 47, 112, 114, 105, 110, 116, 118, 101, 114, 115, 105, 111, 110, 46, 99, 0, 112, 114, 105, 110, 116, 118, 101, 114, 115, 105, 111, 110, 97, 110, 100, 101, 120, 105, 116, 0, 37, 115, 32, 37, 115, 37, 115, 10, 0, 67, 111, 112, 121, 114, 105, 103, 104, 116, 32, 50, 48, 49, 53, 32, 37, 115, 46, 10, 0, 84, 104, 101, 114, 101, 32, 105, 115, 32, 78, 79, 32, 119, 97, 114, 114, 97, 110, 116, 121, 46, 32, 32, 82, 101, 100, 105, 115, 116, 114, 105, 98, 117, 116, 105, 111, 110, 32, 111, 102, 32, 116, 104, 105, 115, 32, 115, 111, 102, 116, 119, 97, 114, 101, 32, 105, 115, 0, 99, 111, 118, 101, 114, 101, 100, 32, 98, 121, 32, 116, 104, 101, 32, 116, 101, 114, 109, 115, 32, 111, 102, 32, 0, 98, 111, 116, 104, 32, 116, 104, 101, 32, 37, 115, 32, 99, 111, 112, 121, 114, 105, 103, 104, 116, 32, 97, 110, 100, 10, 0, 116, 104, 101, 32, 76, 101, 115, 115, 101, 114, 32, 71, 78, 85, 32, 71, 101, 110, 101, 114, 97, 108, 32, 80, 117, 98, 108, 105, 99, 32, 76, 105, 99, 101, 110, 115, 101, 46, 0, 70, 111, 114, 32, 109, 111, 114, 101, 32, 105, 110, 102, 111, 114, 109, 97, 116, 105, 111, 110, 32, 97, 98, 111, 117, 116, 32, 116, 104, 101, 115, 101, 32, 109, 97, 116, 116, 101, 114, 115, 44, 32, 115, 101, 101, 32, 116, 104, 101, 32, 102, 105, 108, 101, 0, 110, 97, 109, 101, 100, 32, 67, 79, 80, 89, 73, 78, 71, 32, 97, 110, 100, 32, 116, 104, 101, 32, 37, 115, 32, 115, 111, 117, 114, 99, 101, 46, 10, 0, 80, 114, 105, 109, 97, 114, 121, 32, 97, 117, 116, 104, 111, 114, 32, 111, 102, 32, 37, 115, 58, 32, 37, 115, 46, 10, 0, 37, 115, 58, 32, 66, 97, 100, 32, 118, 97, 108, 117, 101, 32, 40, 37, 108, 100, 41, 32, 105, 110, 32, 101, 110, 118, 105, 114, 111, 110, 109, 101, 110, 116, 32, 111, 114, 32, 116, 101, 120, 109, 102, 46, 99, 110, 102, 32, 102, 111, 114, 32, 37, 115, 44, 32, 107, 101, 101, 112, 105, 110, 103, 32, 37, 108, 100, 46, 10, 0, 84, 114, 121, 32, 96, 37, 115, 32, 45, 45, 104, 101, 108, 112, 39, 32, 102, 111, 114, 32, 109, 111, 114, 101, 32, 105, 110, 102, 111, 114, 109, 97, 116, 105, 111, 110, 46, 10, 0, 116, 101, 120, 45, 107, 64, 116, 117, 103, 46, 111, 114, 103, 0, 37, 115, 10, 0, 10, 69, 109, 97, 105, 108, 32, 98, 117, 103, 32, 114, 101, 112, 111, 114, 116, 115, 32, 116, 111, 32, 37, 115, 46, 10, 0, 32, 40, 84, 101, 88, 32, 76, 105, 118, 101, 32, 50, 48, 49, 53, 41, 0, 112, 107, 0, 109, 102, 0, 116, 101, 120, 0, 116, 102, 109, 0, 102, 109, 116, 0, 111, 102, 109, 0, 111, 99, 112, 0, 103, 102, 0, 47, 110, 111, 110, 101, 115, 117, 99, 104, 0, 71, 70, 70, 79, 78, 84, 83, 0, 71, 76, 89, 80, 72, 70, 79, 78, 84, 83, 0, 84, 69, 88, 70, 79, 78, 84, 83, 0, 109, 107, 116, 101, 120, 112, 107, 0, 45, 45, 109, 102, 109, 111, 100, 101, 0, 36, 77, 65, 75, 69, 84, 69, 88, 95, 77, 79, 68, 69, 0, 45, 45, 98, 100, 112, 105, 0, 36, 77, 65, 75, 69, 84, 69, 88, 95, 66, 65, 83, 69, 95, 68, 80, 73, 0, 45, 45, 109, 97, 103, 0, 36, 77, 65, 75, 69, 84, 69, 88, 95, 77, 65, 71, 0, 45, 45, 100, 112, 105, 0, 36, 75, 80, 65, 84, 72, 83, 69, 65, 95, 68, 80, 73, 0, 80, 75, 70, 79, 78, 84, 83, 0, 84, 69, 88, 80, 75, 83, 0, 98, 105, 116, 109, 97, 112, 32, 102, 111, 110, 116, 0, 109, 107, 116, 101, 120, 116, 102, 109, 0, 84, 70, 77, 70, 79, 78, 84, 83, 0, 46, 116, 102, 109, 0, 97, 102, 109, 0, 65, 70, 77, 70, 79, 78, 84, 83, 0, 46, 97, 102, 109, 0, 109, 107, 116, 101, 120, 102, 109, 116, 0, 98, 97, 115, 101, 0, 77, 70, 66, 65, 83, 69, 83, 0, 84, 69, 88, 77, 70, 73, 78, 73, 0, 46, 98, 97, 115, 101, 0, 98, 105, 98, 0, 66, 73, 66, 73, 78, 80, 85, 84, 83, 0, 84, 69, 88, 66, 73, 66, 0, 46, 98, 105, 98, 0, 98, 115, 116, 0, 66, 83, 84, 73, 78, 80, 85, 84, 83, 0, 46, 98, 115, 116, 0, 99, 110, 102, 0, 123, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 71, 82, 65, 78, 68, 80, 65, 82, 69, 78, 84, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 115, 104, 97, 114, 101, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 116, 101, 120, 109, 102, 45, 108, 111, 99, 97, 108, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 116, 101, 120, 109, 102, 45, 100, 105, 115, 116, 47, 119, 101, 98, 50, 99, 44, 36, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 47, 116, 101, 120, 109, 102, 47, 119, 101, 98, 50, 99, 125, 0, 84, 69, 88, 77, 70, 67, 78, 70, 0, 46, 99, 110, 102, 0, 108, 115, 45, 82, 0, 84, 69, 88, 77, 70, 68, 66, 83, 0, 108, 115, 45, 114, 0, 84, 69, 88, 70, 79, 82, 77, 65, 84, 83, 0, 46, 102, 109, 116, 0, 109, 97, 112, 0, 84, 69, 88, 70, 79, 78, 84, 77, 65, 80, 83, 0, 46, 109, 97, 112, 0, 109, 101, 109, 0, 77, 80, 77, 69, 77, 83, 0, 46, 109, 101, 109, 0, 109, 107, 116, 101, 120, 109, 102, 0, 77, 70, 73, 78, 80, 85, 84, 83, 0, 46, 109, 102, 0, 109, 102, 116, 0, 77, 70, 84, 73, 78, 80, 85, 84, 83, 0, 46, 109, 102, 116, 0, 109, 102, 112, 111, 111, 108, 0, 77, 70, 80, 79, 79, 76, 0, 46, 112, 111, 111, 108, 0, 109, 112, 0, 77, 80, 73, 78, 80, 85, 84, 83, 0, 46, 109, 112, 0, 109, 112, 112, 111, 111, 108, 0, 77, 80, 80, 79, 79, 76, 0, 77, 101, 116, 97, 80, 111, 115, 116, 32, 115, 117, 112, 112, 111, 114, 116, 0, 77, 80, 83, 85, 80, 80, 79, 82, 84, 0, 109, 107, 111, 99, 112, 0, 79, 67, 80, 73, 78, 80, 85, 84, 83, 0, 46, 111, 99, 112, 0, 109, 107, 111, 102, 109, 0, 79, 70, 77, 70, 79, 78, 84, 83, 0, 46, 111, 102, 109, 0, 111, 112, 108, 0, 79, 80, 76, 70, 79, 78, 84, 83, 0, 46, 111, 112, 108, 0, 46, 112, 108, 0, 111, 116, 112, 0, 79, 84, 80, 73, 78, 80, 85, 84, 83, 0, 46, 111, 116, 112, 0, 111, 118, 102, 0, 79, 86, 70, 70, 79, 78, 84, 83, 0, 46, 111, 118, 102, 0, 46, 118, 102, 0, 111, 118, 112, 0, 79, 86, 80, 70, 79, 78, 84, 83, 0, 46, 111, 118, 112, 0, 46, 118, 112, 108, 0, 103, 114, 97, 112, 104, 105, 99, 47, 102, 105, 103, 117, 114, 101, 0, 84, 69, 88, 80, 73, 67, 84, 83, 0, 84, 69, 88, 73, 78, 80, 85, 84, 83, 0, 46, 101, 112, 115, 0, 46, 101, 112, 115, 105, 0, 109, 107, 116, 101, 120, 116, 101, 120, 0, 46, 116, 101, 120, 0, 46, 115, 116, 121, 0, 46, 99, 108, 115, 0, 46, 102, 100, 0, 46, 97, 117, 120, 0, 46, 98, 98, 108, 0, 46, 100, 101, 102, 0, 46, 99, 108, 111, 0, 46, 108, 100, 102, 0, 80, 111, 115, 116, 83, 99, 114, 105, 112, 116, 32, 104, 101, 97, 100, 101, 114, 0, 84, 69, 88, 80, 83, 72, 69, 65, 68, 69, 82, 83, 0, 80, 83, 72, 69, 65, 68, 69, 82, 83, 0, 46, 112, 114, 111, 0, 84, 101, 88, 32, 115, 121, 115, 116, 101, 109, 32, 100, 111, 99, 117, 109, 101, 110, 116, 97, 116, 105, 111, 110, 0, 84, 69, 88, 68, 79, 67, 83, 0, 116, 101, 120, 112, 111, 111, 108, 0, 84, 69, 88, 80, 79, 79, 76, 0, 84, 101, 88, 32, 115, 121, 115, 116, 101, 109, 32, 115, 111, 117, 114, 99, 101, 115, 0, 84, 69, 88, 83, 79, 85, 82, 67, 69, 83, 0, 46, 100, 116, 120, 0, 46, 105, 110, 115, 0, 84, 114, 111, 102, 102, 32, 102, 111, 110, 116, 115, 0, 47, 117, 115, 114, 123, 47, 108, 111, 99, 97, 108, 44, 125, 47, 115, 104, 97, 114, 101, 47, 103, 114, 111, 102, 102, 47, 123, 99, 117, 114, 114, 101, 110, 116, 47, 102, 111, 110, 116, 44, 115, 105, 116, 101, 45, 102, 111, 110, 116, 125, 47, 100, 101, 118, 112, 115, 0, 84, 82, 70, 79, 78, 84, 83, 0, 116, 121, 112, 101, 49, 32, 102, 111, 110, 116, 115, 0, 84, 49, 70, 79, 78, 84, 83, 0, 84, 49, 73, 78, 80, 85, 84, 83, 0, 46, 112, 102, 97, 0, 46, 112, 102, 98, 0, 118, 102, 0, 86, 70, 70, 79, 78, 84, 83, 0, 100, 118, 105, 112, 115, 32, 99, 111, 110, 102, 105, 103, 0, 84, 69, 88, 67, 79, 78, 70, 73, 71, 0, 105, 115, 116, 0, 84, 69, 88, 73, 78, 68, 69, 88, 83, 84, 89, 76, 69, 0, 73, 78, 68, 69, 88, 83, 84, 89, 76, 69, 0, 46, 105, 115, 116, 0, 116, 114, 117, 101, 116, 121, 112, 101, 32, 102, 111, 110, 116, 115, 0, 84, 84, 70, 79, 78, 84, 83, 0, 46, 116, 116, 102, 0, 46, 116, 116, 99, 0, 46, 84, 84, 70, 0, 46, 84, 84, 67, 0, 46, 100, 102, 111, 110, 116, 0, 116, 121, 112, 101, 52, 50, 32, 102, 111, 110, 116, 115, 0, 84, 52, 50, 70, 79, 78, 84, 83, 0, 46, 116, 52, 50, 0, 46, 84, 52, 50, 0, 119, 101, 98, 50, 99, 32, 102, 105, 108, 101, 115, 0, 87, 69, 66, 50, 67, 0, 111, 116, 104, 101, 114, 32, 116, 101, 120, 116, 32, 102, 105, 108, 101, 115, 0, 36, 84, 69, 88, 77, 70, 47, 0, 47, 47, 0, 73, 78, 80, 85, 84, 83, 0, 111, 116, 104, 101, 114, 32, 98, 105, 110, 97, 114, 121, 32, 102, 105, 108, 101, 115, 0, 109, 105, 115, 99, 32, 102, 111, 110, 116, 115, 0, 77, 73, 83, 67, 70, 79, 78, 84, 83, 0, 119, 101, 98, 0, 87, 69, 66, 73, 78, 80, 85, 84, 83, 0, 46, 119, 101, 98, 0, 46, 99, 104, 0, 99, 119, 101, 98, 0, 67, 87, 69, 66, 73, 78, 80, 85, 84, 83, 0, 46, 119, 0, 101, 110, 99, 32, 102, 105, 108, 101, 115, 0, 69, 78, 67, 70, 79, 78, 84, 83, 0, 46, 101, 110, 99, 0, 99, 109, 97, 112, 32, 102, 105, 108, 101, 115, 0, 67, 77, 65, 80, 70, 79, 78, 84, 83, 0, 115, 117, 98, 102, 111, 110, 116, 32, 100, 101, 102, 105, 110, 105, 116, 105, 111, 110, 32, 102, 105, 108, 101, 115, 0, 83, 70, 68, 70, 79, 78, 84, 83, 0, 46, 115, 102, 100, 0, 111, 112, 101, 110, 116, 121, 112, 101, 32, 102, 111, 110, 116, 115, 0, 79, 80, 69, 78, 84, 89, 80, 69, 70, 79, 78, 84, 83, 0, 46, 111, 116, 102, 0, 112, 100, 102, 116, 101, 120, 32, 99, 111, 110, 102, 105, 103, 0, 80, 68, 70, 84, 69, 88, 67, 79, 78, 70, 73, 71, 0, 108, 105, 103, 32, 102, 105, 108, 101, 115, 0, 76, 73, 71, 70, 79, 78, 84, 83, 0, 46, 108, 105, 103, 0, 116, 101, 120, 109, 102, 115, 99, 114, 105, 112, 116, 115, 0, 84, 69, 88, 77, 70, 83, 67, 82, 73, 80, 84, 83, 0, 108, 117, 97, 0, 76, 85, 65, 73, 78, 80, 85, 84, 83, 0, 46, 108, 117, 97, 0, 46, 108, 117, 97, 116, 101, 120, 0, 46, 108, 117, 99, 0, 46, 108, 117, 99, 116, 101, 120, 0, 46, 116, 101, 120, 108, 117, 97, 0, 46, 116, 101, 120, 108, 117, 99, 0, 46, 116, 108, 117, 0, 102, 111, 110, 116, 32, 102, 101, 97, 116, 117, 114, 101, 32, 102, 105, 108, 101, 115, 0, 70, 79, 78, 84, 70, 69, 65, 84, 85, 82, 69, 83, 0, 46, 102, 101, 97, 0, 99, 105, 100, 32, 109, 97, 112, 115, 0, 70, 79, 78, 84, 67, 73, 68, 77, 65, 80, 83, 0, 46, 99, 105, 100, 0, 46, 99, 105, 100, 109, 97, 112, 0, 109, 108, 98, 105, 98, 0, 77, 76, 66, 73, 66, 73, 78, 80, 85, 84, 83, 0, 46, 109, 108, 98, 105, 98, 0, 109, 108, 98, 115, 116, 0, 77, 76, 66, 83, 84, 73, 78, 80, 85, 84, 83, 0, 46, 109, 108, 98, 115, 116, 0, 99, 108, 117, 97, 0, 46, 58, 36, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 47, 108, 105, 98, 47, 123, 36, 112, 114, 111, 103, 110, 97, 109, 101, 44, 36, 101, 110, 103, 105, 110, 101, 44, 125, 47, 108, 117, 97, 47, 47, 0, 67, 76, 85, 65, 73, 78, 80, 85, 84, 83, 0, 46, 100, 108, 108, 0, 46, 115, 111, 0, 114, 105, 115, 0, 82, 73, 83, 73, 78, 80, 85, 84, 83, 0, 46, 114, 105, 115, 0, 98, 108, 116, 120, 109, 108, 0, 66, 76, 84, 88, 77, 76, 73, 78, 80, 85, 84, 83, 0, 46, 98, 108, 116, 120, 109, 108, 0, 107, 112, 115, 101, 95, 105, 110, 105, 116, 95, 102, 111, 114, 109, 97, 116, 58, 32, 85, 110, 107, 110, 111, 119, 110, 32, 102, 111, 114, 109, 97, 116, 32, 37, 100, 0, 83, 101, 97, 114, 99, 104, 32, 112, 97, 116, 104, 32, 102, 111, 114, 32, 37, 115, 32, 102, 105, 108, 101, 115, 32, 40, 102, 114, 111, 109, 32, 37, 115, 41, 10, 0, 32, 32, 61, 32, 37, 115, 10, 0, 32, 32, 98, 101, 102, 111, 114, 101, 32, 101, 120, 112, 97, 110, 115, 105, 111, 110, 32, 61, 32, 37, 115, 10, 0, 40, 110, 111, 110, 101, 41, 0, 32, 32, 97, 112, 112, 108, 105, 99, 97, 116, 105, 111, 110, 32, 111, 118, 101, 114, 114, 105, 100, 101, 32, 112, 97, 116, 104, 32, 61, 32, 37, 115, 10, 0, 32, 32, 97, 112, 112, 108, 105, 99, 97, 116, 105, 111, 110, 32, 99, 111, 110, 102, 105, 103, 32, 102, 105, 108, 101, 32, 112, 97, 116, 104, 32, 61, 32, 37, 115, 10, 0, 32, 32, 116, 101, 120, 109, 102, 46, 99, 110, 102, 32, 112, 97, 116, 104, 32, 61, 32, 37, 115, 10, 0, 32, 32, 99, 111, 109, 112, 105, 108, 101, 45, 116, 105, 109, 101, 32, 112, 97, 116, 104, 32, 61, 32, 37, 115, 10, 0, 32, 32, 101, 110, 118, 105, 114, 111, 110, 109, 101, 110, 116, 32, 118, 97, 114, 105, 97, 98, 108, 101, 115, 32, 61, 32, 37, 115, 10, 0, 32, 32, 100, 101, 102, 97, 117, 108, 116, 32, 115, 117, 102, 102, 105, 120, 101, 115, 32, 61, 0, 32, 40, 110, 111, 110, 101, 41, 10, 0, 32, 32, 111, 116, 104, 101, 114, 32, 115, 117, 102, 102, 105, 120, 101, 115, 32, 61, 0, 32, 32, 115, 101, 97, 114, 99, 104, 32, 111, 110, 108, 121, 32, 119, 105, 116, 104, 32, 115, 117, 102, 102, 105, 120, 32, 61, 32, 37, 100, 10, 0, 32, 32, 114, 117, 110, 116, 105, 109, 101, 32, 103, 101, 110, 101, 114, 97, 116, 105, 111, 110, 32, 112, 114, 111, 103, 114, 97, 109, 32, 61, 32, 37, 115, 10, 0, 32, 32, 114, 117, 110, 116, 105, 109, 101, 32, 103, 101, 110, 101, 114, 97, 116, 105, 111, 110, 32, 99, 111, 109, 109, 97, 110, 100, 32, 61, 0, 32, 32, 112, 114, 111, 103, 114, 97, 109, 32, 101, 110, 97, 98, 108, 101, 100, 32, 61, 32, 37, 100, 10, 0, 32, 32, 112, 114, 111, 103, 114, 97, 109, 32, 101, 110, 97, 98, 108, 101, 32, 108, 101, 118, 101, 108, 32, 61, 32, 37, 100, 10, 0, 32, 32, 111, 112, 101, 110, 32, 102, 105, 108, 101, 115, 32, 105, 110, 32, 98, 105, 110, 97, 114, 121, 32, 109, 111, 100, 101, 32, 61, 32, 37, 100, 10, 0, 32, 32, 110, 117, 109, 101, 114, 105, 99, 32, 102, 111, 114, 109, 97, 116, 32, 118, 97, 108, 117, 101, 32, 61, 32, 37, 100, 10, 0, 99, 111, 110, 115, 116, 95, 110 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 9380);
allocate([ 97, 109, 101, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 116, 101, 120, 45, 102, 105, 108, 101, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 102, 105, 110, 100, 95, 102, 105, 108, 101, 95, 103, 101, 110, 101, 114, 105, 99, 0, 107, 112, 115, 101, 95, 102, 105, 110, 100, 95, 102, 105, 108, 101, 58, 32, 115, 101, 97, 114, 99, 104, 105, 110, 103, 32, 102, 111, 114, 32, 37, 115, 32, 111, 102, 32, 116, 121, 112, 101, 32, 37, 115, 32, 40, 102, 114, 111, 109, 32, 37, 115, 41, 10, 0, 116, 114, 121, 95, 115, 116, 100, 95, 101, 120, 116, 101, 110, 115, 105, 111, 110, 95, 102, 105, 114, 115, 116, 0, 111, 112, 101, 110, 105, 110, 95, 97, 110, 121, 0, 111, 112, 101, 110, 111, 117, 116, 95, 97, 110, 121, 0, 112, 0, 10, 37, 115, 58, 32, 78, 111, 116, 32, 37, 115, 32, 37, 115, 32, 40, 37, 115, 32, 61, 32, 37, 115, 41, 46, 10, 0, 114, 101, 97, 100, 105, 110, 103, 32, 102, 114, 111, 109, 0, 119, 114, 105, 116, 105, 110, 103, 32, 116, 111, 0, 32, 0, 99, 111, 109, 112, 105, 108, 101, 45, 116, 105, 109, 101, 32, 112, 97, 116, 104, 115, 46, 104, 0, 112, 114, 111, 103, 114, 97, 109, 32, 99, 111, 110, 102, 105, 103, 32, 102, 105, 108, 101, 0, 32, 101, 110, 118, 105, 114, 111, 110, 109, 101, 110, 116, 32, 118, 97, 114, 105, 97, 98, 108, 101, 0, 97, 112, 112, 108, 105, 99, 97, 116, 105, 111, 110, 32, 111, 118, 101, 114, 114, 105, 100, 101, 32, 118, 97, 114, 105, 97, 98, 108, 101, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 99, 110, 102, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 99, 110, 102, 95, 103, 101, 116, 0, 116, 101, 120, 109, 102, 46, 99, 110, 102, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 32, 76, 97, 115, 116, 32, 108, 105, 110, 101, 32, 111, 102, 32, 102, 105, 108, 101, 32, 101, 110, 100, 115, 32, 119, 105, 116, 104, 32, 92, 0, 75, 80, 65, 84, 72, 83, 69, 65, 95, 87, 65, 82, 78, 73, 78, 71, 0, 48, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 99, 111, 110, 102, 105, 103, 117, 114, 97, 116, 105, 111, 110, 32, 102, 105, 108, 101, 32, 116, 101, 120, 109, 102, 46, 99, 110, 102, 32, 110, 111, 116, 32, 102, 111, 117, 110, 100, 32, 105, 110, 32, 116, 104, 101, 115, 101, 32, 100, 105, 114, 101, 99, 116, 111, 114, 105, 101, 115, 58, 32, 37, 115, 0, 100, 98, 58, 105, 110, 105, 116, 40, 41, 58, 32, 115, 107, 105, 112, 112, 105, 110, 103, 32, 100, 98, 32, 115, 97, 109, 101, 95, 102, 105, 108, 101, 95, 112, 32, 37, 115, 44, 32, 119, 105, 108, 108, 32, 97, 100, 100, 32, 37, 115, 46, 10, 0, 100, 98, 58, 105, 110, 105, 116, 40, 41, 58, 32, 117, 115, 105, 110, 103, 32, 100, 98, 32, 102, 105, 108, 101, 32, 37, 115, 46, 10, 0, 97, 108, 105, 97, 115, 101, 115, 0, 100, 98, 58, 109, 97, 116, 99, 104, 40, 37, 115, 44, 37, 115, 41, 32, 61, 32, 37, 100, 10, 0, 37, 115, 58, 32, 37, 117, 32, 97, 108, 105, 97, 115, 101, 115, 46, 10, 0, 97, 108, 105, 97, 115, 32, 104, 97, 115, 104, 32, 116, 97, 98, 108, 101, 58, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 32, 78, 111, 32, 117, 115, 97, 98, 108, 101, 32, 101, 110, 116, 114, 105, 101, 115, 32, 105, 110, 32, 108, 115, 45, 82, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 83, 101, 101, 32, 116, 104, 101, 32, 109, 97, 110, 117, 97, 108, 32, 102, 111, 114, 32, 104, 111, 119, 32, 116, 111, 32, 103, 101, 110, 101, 114, 97, 116, 101, 32, 108, 115, 45, 82, 0, 37, 115, 58, 32, 37, 117, 32, 101, 110, 116, 114, 105, 101, 115, 32, 105, 110, 32, 37, 100, 32, 100, 105, 114, 101, 99, 116, 111, 114, 105, 101, 115, 32, 40, 37, 100, 32, 104, 105, 100, 100, 101, 110, 41, 46, 10, 0, 108, 115, 45, 82, 32, 104, 97, 115, 104, 32, 116, 97, 98, 108, 101, 58, 0, 108, 115, 45, 114, 0, 108, 115, 45, 82, 0, 102, 111, 112, 101, 110, 40, 37, 115, 44, 32, 37, 115, 41, 32, 61, 62, 32, 48, 120, 37, 108, 120, 10, 0, 102, 99, 108, 111, 115, 101, 40, 48, 120, 37, 108, 120, 41, 32, 61, 62, 32, 37, 100, 10, 0, 58, 0, 75, 80, 83, 69, 95, 68, 79, 84, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 32, 85, 110, 109, 97, 116, 99, 104, 101, 100, 32, 123, 0, 116, 101, 120, 102, 111, 110, 116, 115, 46, 109, 97, 112, 0, 114, 0, 64, 99, 0, 105, 110, 99, 108, 117, 100, 101, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 37, 117, 58, 32, 70, 105, 108, 101, 110, 97, 109, 101, 32, 97, 114, 103, 117, 109, 101, 110, 116, 32, 102, 111, 114, 32, 105, 110, 99, 108, 117, 100, 101, 32, 100, 105, 114, 101, 99, 116, 105, 118, 101, 32, 109, 105, 115, 115, 105, 110, 103, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 37, 117, 58, 32, 67, 97, 110, 39, 116, 32, 102, 105, 110, 100, 32, 102, 111, 110, 116, 110, 97, 109, 101, 32, 105, 110, 99, 108, 117, 100, 101, 32, 102, 105, 108, 101, 32, 96, 37, 115, 39, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 37, 117, 58, 32, 70, 111, 110, 116, 110, 97, 109, 101, 32, 97, 108, 105, 97, 115, 32, 109, 105, 115, 115, 105, 110, 103, 32, 102, 111, 114, 32, 102, 105, 108, 101, 110, 97, 109, 101, 32, 96, 37, 115, 39, 0, 104, 97, 115, 104, 95, 108, 111, 111, 107, 117, 112, 40, 37, 115, 41, 32, 61, 62, 0, 32, 40, 110, 105, 108, 41, 10, 0, 37, 108, 100, 0, 37, 52, 100, 32, 0, 58, 37, 45, 53, 100, 0, 32, 37, 115, 61, 62, 37, 115, 0, 37, 117, 32, 98, 117, 99, 107, 101, 116, 115, 44, 32, 37, 117, 32, 110, 111, 110, 101, 109, 112, 116, 121, 32, 40, 37, 117, 37, 37, 41, 59, 32, 37, 117, 32, 101, 110, 116, 114, 105, 101, 115, 44, 32, 97, 118, 101, 114, 97, 103, 101, 32, 99, 104, 97, 105, 110, 32, 37, 46, 49, 102, 46, 10, 0, 102, 97, 108, 108, 98, 97, 99, 107, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 107, 100, 101, 102, 97, 117, 108, 116, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 101, 120, 112, 97, 110, 100, 95, 100, 101, 102, 97, 117, 108, 116, 0, 107, 112, 115, 101, 45, 62, 112, 97, 116, 104, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 112, 97, 116, 104, 45, 101, 108, 116, 46, 99, 0, 101, 108, 101, 109, 101, 110, 116, 0, 115, 116, 97, 114, 116, 32, 115, 101, 97, 114, 99, 104, 40, 102, 105, 108, 101, 115, 61, 91, 37, 115, 0, 93, 44, 32, 109, 117, 115, 116, 95, 101, 120, 105, 115, 116, 61, 37, 100, 44, 32, 102, 105, 110, 100, 95, 97, 108, 108, 61, 37, 100, 44, 32, 112, 97, 116, 104, 61, 37, 115, 41, 46, 10, 0, 115, 101, 97, 114, 99, 104, 40, 91, 37, 115, 0, 93, 41, 32, 61, 62, 0, 115, 116, 97, 114, 116, 32, 115, 101, 97, 114, 99, 104, 40, 102, 105, 108, 101, 61, 37, 115, 44, 32, 109, 117, 115, 116, 95, 101, 120, 105, 115, 116, 61, 37, 100, 44, 32, 102, 105, 110, 100, 95, 97, 108, 108, 61, 37, 100, 44, 32, 112, 97, 116, 104, 61, 37, 115, 41, 46, 10, 0, 115, 101, 97, 114, 99, 104, 40, 37, 115, 41, 32, 61, 62, 0, 84, 69, 88, 77, 70, 76, 79, 71, 0, 37, 108, 117, 32, 37, 115, 10, 0, 80, 65, 84, 72, 0, 75, 80, 65, 84, 72, 83, 69, 65, 95, 68, 69, 66, 85, 71, 0, 83, 69, 76, 70, 65, 85, 84, 79, 76, 79, 67, 0, 83, 69, 76, 70, 65, 85, 84, 79, 68, 73, 82, 0, 83, 69, 76, 70, 65, 85, 84, 79, 80, 65, 82, 69, 78, 84, 0, 83, 69, 76, 70, 65, 85, 84, 79, 71, 82, 65, 78, 68, 80, 65, 82, 69, 78, 84, 0, 101, 120, 101, 0, 111, 108, 100, 0, 97, 0, 115, 110, 112, 114, 105, 110, 116, 102, 32, 40, 98, 117, 102, 44, 32, 50, 44, 32, 34, 97, 34, 41, 32, 61, 61, 32, 49, 32, 38, 38, 32, 98, 117, 102, 91, 49, 93, 32, 61, 61, 32, 39, 92, 48, 39, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 112, 114, 111, 103, 110, 97, 109, 101, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 115, 101, 116, 95, 112, 114, 111, 103, 114, 97, 109, 95, 110, 97, 109, 101, 0, 40, 117, 110, 115, 105, 103, 110, 101, 100, 41, 115, 110, 112, 114, 105, 110, 116, 102, 32, 40, 98, 117, 102, 44, 32, 50, 44, 32, 34, 97, 98, 34, 41, 32, 62, 61, 32, 50, 32, 38, 38, 32, 98, 117, 102, 91, 49, 93, 32, 61, 61, 32, 39, 92, 48, 39, 0, 97, 98, 99, 0, 40, 117, 110, 115, 105, 103, 110, 101, 100, 41, 115, 110, 112, 114, 105, 110, 116, 102, 32, 40, 98, 117, 102, 44, 32, 50, 44, 32, 34, 97, 98, 99, 34, 41, 32, 62, 61, 32, 50, 32, 38, 38, 32, 98, 117, 102, 91, 49, 93, 32, 61, 61, 32, 39, 92, 48, 39, 0, 112, 114, 111, 103, 110, 97, 109, 101, 0, 46, 46, 0, 114, 101, 116, 0, 114, 101, 109, 111, 118, 101, 95, 100, 111, 116, 115 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 19620);
allocate([ 108, 115, 116, 97, 116, 40, 37, 115, 41, 32, 102, 97, 105, 108, 101, 100, 32, 46, 46, 46, 10, 0, 91, 37, 115, 93, 37, 115, 37, 115, 32, 45, 62, 32, 91, 37, 115, 93, 37, 115, 37, 115, 10, 0, 37, 115, 37, 115, 91, 37, 115, 93, 37, 115, 37, 115, 0, 37, 115, 32, 45, 62, 32, 37, 115, 37, 115, 91, 37, 115, 93, 37, 115, 37, 115, 10, 0, 47, 46, 46, 0, 37, 115, 32, 61, 61, 32, 37, 115, 37, 115, 37, 115, 37, 115, 37, 115, 10, 0, 37, 115, 32, 61, 61, 32, 37, 115, 37, 115, 37, 115, 10 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 23645);
allocate([ 114, 101, 97, 100, 97, 98, 108, 101, 0, 84, 69, 88, 95, 72, 85, 83, 72, 0, 97, 108, 108, 0, 110, 111, 110, 101, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 109, 97, 107, 101, 95, 116, 101, 120, 58, 32, 73, 110, 118, 97, 108, 105, 100, 32, 102, 111, 110, 116, 110, 97, 109, 101, 32, 96, 37, 115, 39, 44, 32, 115, 116, 97, 114, 116, 115, 32, 119, 105, 116, 104, 32, 39, 37, 99, 39, 10, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 109, 97, 107, 101, 95, 116, 101, 120, 58, 32, 73, 110, 118, 97, 108, 105, 100, 32, 102, 111, 110, 116, 110, 97, 109, 101, 32, 96, 37, 115, 39, 44, 32, 99, 111, 110, 116, 97, 105, 110, 115, 32, 39, 37, 99, 39, 10, 0, 10, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 82, 117, 110, 110, 105, 110, 103, 0, 47, 100, 101, 118, 47, 110, 117, 108, 108, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 111, 112, 101, 110, 40, 34, 47, 100, 101, 118, 47, 110, 117, 108, 108, 34, 44, 32, 79, 95, 82, 68, 79, 78, 76, 89, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 112, 105, 112, 101, 40, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 111, 112, 101, 110, 40, 34, 47, 100, 101, 118, 47, 110, 117, 108, 108, 34, 44, 32, 79, 95, 87, 82, 79, 78, 76, 89, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 102, 111, 114, 107, 40, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 114, 101, 97, 100, 40, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 32, 111, 117, 116, 112, 117, 116, 32, 96, 37, 115, 39, 32, 105, 110, 115, 116, 101, 97, 100, 32, 111, 102, 32, 97, 32, 102, 105, 108, 101, 110, 97, 109, 101, 0, 77, 73, 83, 83, 70, 79, 78, 84, 95, 76, 79, 71, 0, 109, 105, 115, 115, 102, 111, 110, 116, 46, 108, 111, 103, 0, 97, 98, 0, 84, 69, 88, 77, 70, 79, 85, 84, 80, 85, 84, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 65, 112, 112, 101, 110, 100, 105, 110, 103, 32, 102, 111, 110, 116, 32, 99, 114, 101, 97, 116, 105, 111, 110, 32, 99, 111, 109, 109, 97, 110, 100, 115, 32, 116, 111, 32, 37, 115, 46, 10, 0, 75, 80, 65, 84, 72, 83, 69, 65, 95, 68, 80, 73, 0, 77, 65, 75, 69, 84, 69, 88, 95, 66, 65, 83, 69, 95, 68, 80, 73, 0, 100, 112, 105, 32, 33, 61, 32, 48, 32, 38, 38, 32, 98, 100, 112, 105, 32, 33, 61, 32, 48, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 116, 101, 120, 45, 109, 97, 107, 101, 46, 99, 0, 115, 101, 116, 95, 109, 97, 107, 101, 116, 101, 120, 95, 109, 97, 103, 0, 37, 117, 43, 37, 117, 47, 37, 117, 0, 37, 117, 43, 37, 117, 47, 40, 37, 117, 42, 37, 117, 43, 37, 117, 41, 0, 37, 117, 43, 37, 117, 47, 40, 37, 117, 42, 37, 117, 41, 0, 37, 117, 43, 37, 117, 47, 40, 52, 48, 48, 48, 43, 37, 117, 41, 0, 45, 0, 109, 97, 103, 115, 116, 101, 112, 92, 40, 37, 115, 37, 100, 46, 37, 100, 92, 41, 0, 77, 65, 75, 69, 84, 69, 88, 95, 77, 65, 71, 0, 110, 97, 109, 101, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 116, 105, 108, 100, 101, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 116, 105, 108, 100, 101, 95, 101, 120, 112, 97, 110, 100, 0, 33, 33, 0, 0, 72, 79, 77, 69, 0, 107, 112, 115, 101, 45, 62, 112, 114, 111, 103, 114, 97, 109, 95, 110, 97, 109, 101, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 118, 97, 114, 105, 97, 98, 108, 101, 46, 99, 0, 107, 112, 97, 116, 104, 115, 101, 97, 95, 118, 97, 114, 95, 118, 97, 108, 117, 101, 0, 95, 0, 40, 110, 105, 108, 41, 0, 118, 97, 114, 105, 97, 98, 108, 101, 58, 32, 37, 115, 32, 61, 32, 37, 115, 10, 0, 119, 97, 114, 110, 105, 110, 103, 58, 32, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 32, 78, 111, 32, 109, 97, 116, 99, 104, 105, 110, 103, 32, 125, 32, 102, 111, 114, 32, 36, 123, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 37, 115, 58, 32, 85, 110, 114, 101, 99, 111, 103, 110, 105, 122, 101, 100, 32, 118, 97, 114, 105, 97, 98, 108, 101, 32, 99, 111, 110, 115, 116, 114, 117, 99, 116, 32, 96, 36, 37, 99, 39, 0, 107, 112, 97, 116, 104, 115, 101, 97, 58, 32, 118, 97, 114, 105, 97, 98, 108, 101, 32, 96, 37, 115, 39, 32, 114, 101, 102, 101, 114, 101, 110, 99, 101, 115, 32, 105, 116, 115, 101, 108, 102, 32, 40, 101, 118, 101, 110, 116, 117, 97, 108, 108, 121, 41, 0, 107, 112, 97, 116, 104, 115, 101, 97, 32, 118, 101, 114, 115, 105, 111, 110, 32, 54, 46, 50, 46, 49, 0, 102, 105, 108, 101, 110, 97, 109, 101, 32, 38, 38, 32, 109, 111, 100, 101, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 120, 102, 111, 112, 101, 110, 46, 99, 0, 120, 102, 111, 112, 101, 110, 0, 102, 0, 120, 102, 99, 108, 111, 115, 101, 0, 37, 115, 58, 32, 0, 103, 101, 116, 99, 119, 100, 0, 102, 97, 116, 97, 108, 58, 32, 109, 101, 109, 111, 114, 121, 32, 101, 120, 104, 97, 117, 115, 116, 101, 100, 32, 40, 120, 109, 97, 108, 108, 111, 99, 32, 111, 102, 32, 37, 108, 117, 32, 98, 121, 116, 101, 115, 41, 46, 10, 0, 61, 0, 112, 117, 116, 101, 110, 118, 40, 37, 115, 41, 0, 102, 97, 116, 97, 108, 58, 32, 109, 101, 109, 111, 114, 121, 32, 101, 120, 104, 97, 117, 115, 116, 101, 100, 32, 40, 114, 101, 97, 108, 108, 111, 99, 32, 111, 102, 32, 37, 108, 117, 32, 98, 121, 116, 101, 115, 41, 46, 10, 0, 107, 112, 115, 101, 95, 110, 111, 114, 109, 97, 108, 105, 122, 101, 95, 112, 97, 116, 104, 32, 40, 37, 115, 41, 32, 61, 62, 32, 37, 117, 10, 0, 112, 97, 116, 104, 32, 101, 108, 101, 109, 101, 110, 116, 32, 37, 115, 32, 61, 62, 0, 32, 37, 115, 0, 47, 0, 73, 83, 95, 68, 73, 82, 95, 83, 69, 80, 95, 67, 72, 32, 40, 101, 108, 116, 91, 101, 108, 116, 95, 108, 101, 110, 103, 116, 104, 32, 45, 32, 49, 93, 41, 32, 124, 124, 32, 73, 83, 95, 68, 69, 86, 73, 67, 69, 95, 83, 69, 80, 32, 40, 101, 108, 116, 91, 101, 108, 116, 95, 108, 101, 110, 103, 116, 104, 32, 45, 32, 49, 93, 41, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 101, 108, 116, 45, 100, 105, 114, 115, 46, 99, 0, 100, 111, 95, 115, 117, 98, 100, 105, 114, 0, 70, 78, 95, 83, 84, 82, 73, 78, 71, 32, 40, 42, 102, 41, 32, 33, 61, 32, 78, 85, 76, 76, 0, 46, 46, 47, 46, 46, 47, 46, 46, 47, 116, 101, 120, 108, 105, 118, 101, 45, 50, 48, 49, 53, 48, 53, 50, 49, 45, 115, 111, 117, 114, 99, 101, 47, 116, 101, 120, 107, 47, 107, 112, 97, 116, 104, 115, 101, 97, 47, 102, 110, 46, 99, 0, 102, 110, 95, 102, 114, 101, 101, 0, 70, 78, 95, 76, 69, 78, 71, 84, 72, 32, 40, 42, 102, 41, 32, 62, 32, 108, 111, 99, 0, 102, 110, 95, 115, 104, 114, 105, 110, 107, 95, 116, 111, 0, 37, 115, 58, 32, 102, 97, 116, 97, 108, 58, 32, 0, 99, 108, 111, 115, 101, 100, 105, 114, 32, 102, 97, 105, 108, 101, 100, 0, 46, 10, 0, 107, 100, 101, 98, 117, 103, 58, 0, 100, 105, 114, 95, 108, 105, 110, 107, 115, 40, 37, 115, 41, 32, 61, 62, 32, 37, 108, 100, 10, 0, 58, 32, 105, 108, 108, 101, 103, 97, 108, 32, 111, 112, 116, 105, 111, 110, 58, 32, 0, 10, 0, 58, 32, 111, 112, 116, 105, 111, 110, 32, 114, 101, 113, 117, 105, 114, 101, 115, 32, 97, 110, 32, 97, 114, 103, 117, 109, 101, 110, 116, 58, 32, 0, 84, 33, 34, 25, 13, 1, 2, 3, 17, 75, 28, 12, 16, 4, 11, 29, 18, 30, 39, 104, 110, 111, 112, 113, 98, 32, 5, 6, 15, 19, 20, 21, 26, 8, 22, 7, 40, 36, 23, 24, 9, 10, 14, 27, 31, 37, 35, 131, 130, 125, 38, 42, 43, 60, 61, 62, 63, 67, 71, 74, 77, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103, 105, 106, 107, 108, 114, 115, 116, 121, 122, 123, 124, 0, 73, 108, 108, 101, 103, 97, 108, 32, 98, 121, 116, 101, 32, 115, 101, 113, 117, 101, 110, 99, 101, 0, 68, 111, 109, 97, 105, 110, 32, 101, 114, 114, 111, 114, 0, 82, 101, 115, 117, 108, 116, 32, 110, 111, 116, 32, 114, 101, 112, 114, 101, 115, 101, 110, 116, 97, 98, 108, 101, 0, 78, 111, 116, 32, 97, 32, 116, 116, 121, 0, 80, 101, 114, 109, 105, 115, 115, 105, 111, 110, 32, 100, 101, 110, 105, 101, 100, 0, 79, 112, 101, 114, 97, 116, 105, 111, 110, 32, 110, 111, 116, 32, 112, 101, 114, 109, 105, 116, 116, 101, 100, 0, 78, 111, 32, 115, 117, 99, 104, 32, 102, 105, 108, 101, 32, 111, 114, 32, 100, 105, 114, 101, 99, 116, 111, 114, 121, 0, 78, 111, 32, 115, 117, 99, 104, 32, 112, 114, 111, 99, 101, 115, 115, 0, 70, 105, 108, 101, 32, 101, 120, 105, 115, 116, 115, 0, 86, 97, 108, 117, 101, 32, 116, 111, 111, 32, 108, 97, 114, 103, 101, 32, 102, 111, 114, 32, 100, 97, 116, 97, 32, 116, 121, 112, 101, 0, 78, 111, 32, 115, 112, 97, 99, 101, 32, 108, 101, 102, 116, 32, 111, 110, 32, 100, 101, 118, 105, 99, 101, 0, 79, 117, 116, 32, 111, 102, 32, 109, 101, 109, 111, 114, 121, 0, 82, 101, 115, 111, 117, 114, 99, 101, 32, 98, 117, 115, 121, 0, 73, 110, 116, 101, 114, 114, 117, 112, 116, 101, 100, 32, 115, 121, 115, 116, 101, 109, 32, 99, 97, 108, 108, 0, 82, 101, 115, 111, 117, 114, 99, 101, 32, 116, 101, 109, 112, 111, 114, 97, 114, 105, 108, 121, 32, 117, 110, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 73, 110, 118, 97, 108, 105, 100, 32, 115, 101, 101, 107, 0, 67, 114, 111, 115, 115, 45, 100, 101, 118, 105, 99, 101, 32, 108, 105, 110, 107, 0, 82, 101, 97, 100, 45, 111, 110, 108, 121, 32, 102, 105, 108, 101, 32, 115, 121, 115, 116, 101, 109, 0, 68, 105, 114, 101, 99, 116, 111, 114, 121, 32, 110, 111, 116, 32, 101, 109, 112, 116, 121, 0, 67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 32, 114, 101, 115, 101, 116, 32, 98, 121, 32, 112, 101, 101, 114, 0, 79, 112, 101, 114, 97, 116, 105, 111, 110, 32, 116, 105, 109, 101, 100, 32, 111, 117, 116, 0, 67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 32, 114, 101, 102, 117, 115, 101, 100, 0, 72, 111, 115, 116, 32, 105, 115, 32, 100, 111, 119, 110, 0, 72, 111, 115, 116, 32, 105, 115, 32, 117, 110, 114, 101, 97, 99, 104, 97, 98, 108, 101, 0, 65, 100, 100, 114, 101, 115, 115, 32, 105, 110, 32, 117, 115, 101, 0, 66, 114, 111, 107, 101, 110, 32, 112, 105, 112, 101, 0, 73, 47, 79, 32, 101, 114, 114, 111, 114, 0, 78, 111, 32, 115, 117, 99, 104, 32, 100, 101, 118, 105, 99, 101, 32, 111, 114, 32, 97, 100, 100, 114, 101, 115, 115, 0, 66, 108, 111, 99, 107, 32, 100, 101, 118, 105, 99, 101, 32, 114, 101, 113, 117, 105, 114, 101, 100, 0, 78, 111, 32, 115, 117, 99, 104, 32, 100, 101, 118, 105, 99, 101, 0, 78, 111, 116, 32, 97, 32, 100, 105, 114, 101, 99, 116, 111, 114, 121, 0, 73, 115, 32, 97, 32, 100, 105, 114, 101, 99, 116, 111, 114, 121, 0, 84, 101, 120, 116, 32, 102, 105, 108, 101, 32, 98, 117, 115, 121, 0, 69, 120, 101, 99, 32, 102, 111, 114, 109, 97, 116, 32, 101, 114, 114, 111, 114, 0, 73, 110, 118, 97, 108, 105, 100, 32, 97, 114, 103, 117, 109, 101, 110, 116, 0, 65, 114, 103, 117, 109, 101, 110, 116, 32, 108, 105, 115, 116, 32, 116, 111, 111, 32, 108, 111, 110, 103, 0, 83, 121, 109, 98, 111, 108, 105, 99, 32, 108, 105, 110, 107, 32, 108, 111, 111, 112, 0, 70, 105, 108, 101, 110, 97, 109, 101, 32, 116, 111, 111, 32, 108, 111, 110, 103, 0, 84, 111, 111, 32, 109, 97, 110, 121, 32, 111, 112, 101, 110, 32, 102, 105, 108, 101, 115, 32, 105, 110, 32, 115, 121, 115, 116, 101, 109, 0, 78, 111, 32, 102, 105, 108, 101, 32, 100, 101, 115, 99, 114, 105, 112, 116, 111, 114, 115, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 66, 97, 100, 32, 102, 105, 108, 101, 32, 100, 101, 115, 99, 114, 105, 112, 116, 111, 114, 0, 78, 111, 32, 99, 104, 105, 108, 100, 32, 112, 114, 111, 99, 101, 115, 115, 0, 66, 97, 100, 32, 97, 100, 100, 114, 101, 115, 115, 0, 70, 105, 108, 101, 32, 116, 111, 111, 32, 108, 97, 114, 103, 101, 0, 84, 111, 111, 32, 109, 97, 110, 121, 32, 108, 105, 110, 107, 115, 0, 78, 111, 32, 108, 111, 99, 107, 115, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 82, 101, 115, 111, 117, 114, 99, 101, 32, 100, 101, 97, 100, 108, 111, 99, 107, 32, 119, 111, 117, 108, 100, 32, 111, 99, 99, 117, 114, 0, 83, 116, 97, 116, 101, 32, 110, 111, 116, 32, 114, 101, 99, 111, 118, 101, 114, 97, 98, 108, 101, 0, 80, 114, 101, 118, 105, 111, 117, 115, 32, 111, 119, 110, 101, 114, 32, 100, 105, 101, 100, 0, 79, 112, 101, 114, 97, 116, 105, 111, 110, 32, 99, 97, 110, 99, 101, 108, 101, 100, 0, 70, 117, 110, 99, 116, 105, 111, 110, 32, 110, 111, 116, 32, 105, 109, 112, 108, 101, 109, 101, 110, 116, 101, 100, 0, 78, 111, 32, 109, 101, 115, 115, 97, 103, 101, 32, 111, 102, 32, 100, 101, 115, 105, 114, 101, 100, 32, 116, 121, 112, 101, 0, 73, 100, 101, 110, 116, 105, 102, 105, 101, 114, 32, 114, 101, 109, 111, 118, 101, 100, 0, 68, 101, 118, 105, 99, 101, 32, 110, 111, 116, 32, 97, 32, 115, 116, 114, 101, 97, 109, 0, 78, 111, 32, 100, 97, 116, 97, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 68, 101, 118, 105, 99, 101, 32, 116, 105, 109, 101, 111, 117, 116, 0, 79, 117, 116, 32, 111, 102, 32, 115, 116, 114, 101, 97, 109, 115, 32, 114, 101, 115, 111, 117, 114, 99, 101, 115, 0, 76, 105, 110, 107, 32, 104, 97, 115, 32, 98, 101, 101, 110, 32, 115, 101, 118, 101, 114, 101, 100, 0, 80, 114, 111, 116, 111, 99, 111, 108, 32, 101, 114, 114, 111, 114, 0, 66, 97, 100, 32, 109, 101, 115, 115, 97, 103, 101, 0, 70, 105, 108, 101, 32, 100, 101, 115, 99, 114, 105, 112, 116, 111, 114, 32, 105, 110, 32, 98, 97, 100, 32, 115, 116, 97, 116, 101, 0, 78, 111, 116, 32, 97, 32, 115, 111, 99, 107, 101, 116, 0, 68, 101, 115, 116, 105, 110, 97, 116, 105, 111, 110, 32, 97, 100, 100, 114, 101, 115, 115, 32, 114, 101, 113, 117, 105, 114, 101, 100, 0, 77, 101, 115, 115, 97, 103, 101, 32, 116, 111, 111, 32, 108, 97, 114, 103, 101, 0, 80, 114, 111, 116, 111, 99, 111, 108, 32, 119, 114, 111, 110, 103, 32, 116, 121, 112, 101, 32, 102, 111, 114, 32, 115, 111, 99, 107, 101, 116, 0, 80, 114, 111, 116, 111, 99, 111, 108, 32, 110, 111, 116, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 80, 114, 111, 116, 111, 99, 111, 108, 32, 110, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 0, 83, 111, 99, 107, 101, 116, 32, 116, 121, 112, 101, 32, 110, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 0, 78, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 0, 80, 114, 111, 116, 111, 99, 111, 108, 32, 102, 97, 109, 105, 108, 121, 32, 110, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 0, 65, 100, 100, 114, 101, 115, 115, 32, 102, 97, 109, 105, 108, 121, 32, 110, 111, 116, 32, 115, 117, 112, 112, 111, 114, 116, 101, 100, 32, 98, 121, 32, 112, 114, 111, 116, 111, 99, 111, 108, 0, 65, 100, 100, 114, 101, 115, 115, 32, 110, 111, 116, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 78, 101, 116, 119, 111, 114, 107, 32, 105, 115, 32, 100, 111, 119, 110, 0, 78, 101, 116, 119, 111, 114, 107, 32, 117, 110, 114, 101, 97, 99, 104, 97, 98, 108, 101, 0, 67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 32, 114, 101, 115, 101, 116, 32, 98, 121, 32, 110, 101, 116, 119, 111, 114, 107, 0, 67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 32, 97, 98, 111, 114, 116, 101, 100, 0, 78, 111, 32, 98, 117, 102, 102, 101, 114, 32, 115, 112, 97, 99, 101, 32, 97, 118, 97, 105, 108, 97, 98, 108, 101, 0, 83, 111, 99, 107, 101, 116, 32, 105, 115, 32, 99, 111, 110, 110, 101, 99, 116, 101, 100, 0, 83, 111, 99, 107, 101, 116, 32, 110, 111, 116, 32, 99, 111, 110, 110, 101, 99, 116, 101, 100, 0, 67, 97, 110, 110, 111, 116, 32, 115, 101, 110, 100, 32, 97, 102, 116, 101, 114, 32, 115, 111, 99, 107, 101, 116, 32, 115, 104, 117, 116, 100, 111, 119, 110, 0, 79, 112, 101, 114, 97, 116, 105, 111, 110, 32, 97, 108, 114, 101, 97, 100, 121, 32, 105, 110, 32, 112, 114, 111, 103, 114, 101, 115, 115, 0, 79, 112, 101, 114, 97, 116, 105, 111, 110, 32, 105, 110, 32, 112, 114, 111, 103, 114, 101, 115, 115, 0, 83, 116, 97, 108, 101, 32, 102, 105, 108, 101, 32, 104, 97, 110, 100, 108, 101, 0, 82, 101, 109, 111, 116, 101, 32, 73, 47, 79, 32, 101, 114, 114, 111, 114, 0, 81, 117, 111, 116, 97, 32, 101, 120, 99, 101, 101, 100, 101, 100, 0, 78, 111, 32, 109, 101, 100, 105, 117, 109, 32, 102, 111, 117, 110, 100, 0, 87, 114, 111, 110, 103, 32, 109, 101, 100, 105, 117, 109, 32, 116, 121, 112, 101, 0, 78, 111, 32, 101, 114, 114, 111, 114, 32, 105, 110, 102, 111, 114, 109, 97, 116, 105, 111, 110, 0, 0, 114, 119, 97 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 27854);
allocate([ 17, 0, 10, 0, 17, 17, 17, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 15, 10, 17, 17, 17, 3, 10, 7, 0, 1, 19, 9, 11, 11, 0, 0, 9, 6, 11, 0, 0, 11, 0, 6, 17, 0, 0, 0, 17, 17, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 17, 0, 10, 10, 17, 17, 17, 0, 10, 0, 0, 2, 0, 9, 11, 0, 0, 0, 9, 0, 11, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 0, 0, 9, 12, 0, 0, 0, 0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 0, 0, 0, 4, 13, 0, 0, 0, 0, 9, 14, 0, 0, 0, 0, 0, 14, 0, 0, 14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 15, 0, 0, 0, 0, 9, 16, 0, 0, 0, 0, 0, 16, 0, 0, 16, 0, 0, 18, 0, 0, 0, 18, 18, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 0, 0, 0, 18, 18, 18, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 9, 11, 0, 0, 0, 0, 0, 11, 0, 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 0, 0, 9, 12, 0, 0, 0, 0, 0, 12, 0, 0, 12, 0, 0, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67, 68, 69, 70, 45, 43, 32, 32, 32, 48, 88, 48, 120, 0, 40, 110, 117, 108, 108, 41, 0, 45, 48, 88, 43, 48, 88, 32, 48, 88, 45, 48, 120, 43, 48, 120, 32, 48, 120, 0, 105, 110, 102, 0, 73, 78, 70, 0, 110, 97, 110, 0, 78, 65, 78, 0, 46, 0 ], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE + 33509);
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
assert(tempDoublePtr % 8 == 0);
function copyTempFloat(ptr) {
 HEAP8[tempDoublePtr] = HEAP8[ptr];
 HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
 HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
 HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
}
function copyTempDouble(ptr) {
 HEAP8[tempDoublePtr] = HEAP8[ptr];
 HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
 HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
 HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
 HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
 HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
 HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
 HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
}
Module["_i64Subtract"] = _i64Subtract;
function ___assert_fail(condition, filename, line, func) {
 ABORT = true;
 throw "Assertion failed: " + Pointer_stringify(condition) + ", at: " + [ filename ? Pointer_stringify(filename) : "unknown filename", line, func ? Pointer_stringify(func) : "unknown function" ] + " at " + stackTrace();
}
var PROCINFO = {
 ppid: 1,
 pid: 42,
 sid: 42,
 pgid: 42
};
var ERRNO_CODES = {
 EPERM: 1,
 ENOENT: 2,
 ESRCH: 3,
 EINTR: 4,
 EIO: 5,
 ENXIO: 6,
 E2BIG: 7,
 ENOEXEC: 8,
 EBADF: 9,
 ECHILD: 10,
 EAGAIN: 11,
 EWOULDBLOCK: 11,
 ENOMEM: 12,
 EACCES: 13,
 EFAULT: 14,
 ENOTBLK: 15,
 EBUSY: 16,
 EEXIST: 17,
 EXDEV: 18,
 ENODEV: 19,
 ENOTDIR: 20,
 EISDIR: 21,
 EINVAL: 22,
 ENFILE: 23,
 EMFILE: 24,
 ENOTTY: 25,
 ETXTBSY: 26,
 EFBIG: 27,
 ENOSPC: 28,
 ESPIPE: 29,
 EROFS: 30,
 EMLINK: 31,
 EPIPE: 32,
 EDOM: 33,
 ERANGE: 34,
 ENOMSG: 42,
 EIDRM: 43,
 ECHRNG: 44,
 EL2NSYNC: 45,
 EL3HLT: 46,
 EL3RST: 47,
 ELNRNG: 48,
 EUNATCH: 49,
 ENOCSI: 50,
 EL2HLT: 51,
 EDEADLK: 35,
 ENOLCK: 37,
 EBADE: 52,
 EBADR: 53,
 EXFULL: 54,
 ENOANO: 55,
 EBADRQC: 56,
 EBADSLT: 57,
 EDEADLOCK: 35,
 EBFONT: 59,
 ENOSTR: 60,
 ENODATA: 61,
 ETIME: 62,
 ENOSR: 63,
 ENONET: 64,
 ENOPKG: 65,
 EREMOTE: 66,
 ENOLINK: 67,
 EADV: 68,
 ESRMNT: 69,
 ECOMM: 70,
 EPROTO: 71,
 EMULTIHOP: 72,
 EDOTDOT: 73,
 EBADMSG: 74,
 ENOTUNIQ: 76,
 EBADFD: 77,
 EREMCHG: 78,
 ELIBACC: 79,
 ELIBBAD: 80,
 ELIBSCN: 81,
 ELIBMAX: 82,
 ELIBEXEC: 83,
 ENOSYS: 38,
 ENOTEMPTY: 39,
 ENAMETOOLONG: 36,
 ELOOP: 40,
 EOPNOTSUPP: 95,
 EPFNOSUPPORT: 96,
 ECONNRESET: 104,
 ENOBUFS: 105,
 EAFNOSUPPORT: 97,
 EPROTOTYPE: 91,
 ENOTSOCK: 88,
 ENOPROTOOPT: 92,
 ESHUTDOWN: 108,
 ECONNREFUSED: 111,
 EADDRINUSE: 98,
 ECONNABORTED: 103,
 ENETUNREACH: 101,
 ENETDOWN: 100,
 ETIMEDOUT: 110,
 EHOSTDOWN: 112,
 EHOSTUNREACH: 113,
 EINPROGRESS: 115,
 EALREADY: 114,
 EDESTADDRREQ: 89,
 EMSGSIZE: 90,
 EPROTONOSUPPORT: 93,
 ESOCKTNOSUPPORT: 94,
 EADDRNOTAVAIL: 99,
 ENETRESET: 102,
 EISCONN: 106,
 ENOTCONN: 107,
 ETOOMANYREFS: 109,
 EUSERS: 87,
 EDQUOT: 122,
 ESTALE: 116,
 ENOTSUP: 95,
 ENOMEDIUM: 123,
 EILSEQ: 84,
 EOVERFLOW: 75,
 ECANCELED: 125,
 ENOTRECOVERABLE: 131,
 EOWNERDEAD: 130,
 ESTRPIPE: 86
};
var ERRNO_MESSAGES = {
 0: "Success",
 1: "Not super-user",
 2: "No such file or directory",
 3: "No such process",
 4: "Interrupted system call",
 5: "I/O error",
 6: "No such device or address",
 7: "Arg list too long",
 8: "Exec format error",
 9: "Bad file number",
 10: "No children",
 11: "No more processes",
 12: "Not enough core",
 13: "Permission denied",
 14: "Bad address",
 15: "Block device required",
 16: "Mount device busy",
 17: "File exists",
 18: "Cross-device link",
 19: "No such device",
 20: "Not a directory",
 21: "Is a directory",
 22: "Invalid argument",
 23: "Too many open files in system",
 24: "Too many open files",
 25: "Not a typewriter",
 26: "Text file busy",
 27: "File too large",
 28: "No space left on device",
 29: "Illegal seek",
 30: "Read only file system",
 31: "Too many links",
 32: "Broken pipe",
 33: "Math arg out of domain of func",
 34: "Math result not representable",
 35: "File locking deadlock error",
 36: "File or path name too long",
 37: "No record locks available",
 38: "Function not implemented",
 39: "Directory not empty",
 40: "Too many symbolic links",
 42: "No message of desired type",
 43: "Identifier removed",
 44: "Channel number out of range",
 45: "Level 2 not synchronized",
 46: "Level 3 halted",
 47: "Level 3 reset",
 48: "Link number out of range",
 49: "Protocol driver not attached",
 50: "No CSI structure available",
 51: "Level 2 halted",
 52: "Invalid exchange",
 53: "Invalid request descriptor",
 54: "Exchange full",
 55: "No anode",
 56: "Invalid request code",
 57: "Invalid slot",
 59: "Bad font file fmt",
 60: "Device not a stream",
 61: "No data (for no delay io)",
 62: "Timer expired",
 63: "Out of streams resources",
 64: "Machine is not on the network",
 65: "Package not installed",
 66: "The object is remote",
 67: "The link has been severed",
 68: "Advertise error",
 69: "Srmount error",
 70: "Communication error on send",
 71: "Protocol error",
 72: "Multihop attempted",
 73: "Cross mount point (not really error)",
 74: "Trying to read unreadable message",
 75: "Value too large for defined data type",
 76: "Given log. name not unique",
 77: "f.d. invalid for this operation",
 78: "Remote address changed",
 79: "Can   access a needed shared lib",
 80: "Accessing a corrupted shared lib",
 81: ".lib section in a.out corrupted",
 82: "Attempting to link in too many libs",
 83: "Attempting to exec a shared library",
 84: "Illegal byte sequence",
 86: "Streams pipe error",
 87: "Too many users",
 88: "Socket operation on non-socket",
 89: "Destination address required",
 90: "Message too long",
 91: "Protocol wrong type for socket",
 92: "Protocol not available",
 93: "Unknown protocol",
 94: "Socket type not supported",
 95: "Not supported",
 96: "Protocol family not supported",
 97: "Address family not supported by protocol family",
 98: "Address already in use",
 99: "Address not available",
 100: "Network interface is not configured",
 101: "Network is unreachable",
 102: "Connection reset by network",
 103: "Connection aborted",
 104: "Connection reset by peer",
 105: "No buffer space available",
 106: "Socket is already connected",
 107: "Socket is not connected",
 108: "Can't send after socket shutdown",
 109: "Too many references",
 110: "Connection timed out",
 111: "Connection refused",
 112: "Host is down",
 113: "Host is unreachable",
 114: "Socket already connected",
 115: "Connection already in progress",
 116: "Stale file handle",
 122: "Quota exceeded",
 123: "No medium (in tape drive)",
 125: "Operation canceled",
 130: "Previous owner died",
 131: "State not recoverable"
};
function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
 return value;
}
var PATH = {
 splitPath: (function(filename) {
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  return splitPathRe.exec(filename).slice(1);
 }),
 normalizeArray: (function(parts, allowAboveRoot) {
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
   var last = parts[i];
   if (last === ".") {
    parts.splice(i, 1);
   } else if (last === "..") {
    parts.splice(i, 1);
    up++;
   } else if (up) {
    parts.splice(i, 1);
    up--;
   }
  }
  if (allowAboveRoot) {
   for (; up--; up) {
    parts.unshift("..");
   }
  }
  return parts;
 }),
 normalize: (function(path) {
  var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
  path = PATH.normalizeArray(path.split("/").filter((function(p) {
   return !!p;
  })), !isAbsolute).join("/");
  if (!path && !isAbsolute) {
   path = ".";
  }
  if (path && trailingSlash) {
   path += "/";
  }
  return (isAbsolute ? "/" : "") + path;
 }),
 dirname: (function(path) {
  var result = PATH.splitPath(path), root = result[0], dir = result[1];
  if (!root && !dir) {
   return ".";
  }
  if (dir) {
   dir = dir.substr(0, dir.length - 1);
  }
  return root + dir;
 }),
 basename: (function(path) {
  if (path === "/") return "/";
  var lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return path;
  return path.substr(lastSlash + 1);
 }),
 extname: (function(path) {
  return PATH.splitPath(path)[3];
 }),
 join: (function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return PATH.normalize(paths.join("/"));
 }),
 join2: (function(l, r) {
  return PATH.normalize(l + "/" + r);
 }),
 resolve: (function() {
  var resolvedPath = "", resolvedAbsolute = false;
  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
   var path = i >= 0 ? arguments[i] : FS.cwd();
   if (typeof path !== "string") {
    throw new TypeError("Arguments to path.resolve must be strings");
   } else if (!path) {
    return "";
   }
   resolvedPath = path + "/" + resolvedPath;
   resolvedAbsolute = path.charAt(0) === "/";
  }
  resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter((function(p) {
   return !!p;
  })), !resolvedAbsolute).join("/");
  return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
 }),
 relative: (function(from, to) {
  from = PATH.resolve(from).substr(1);
  to = PATH.resolve(to).substr(1);
  function trim(arr) {
   var start = 0;
   for (; start < arr.length; start++) {
    if (arr[start] !== "") break;
   }
   var end = arr.length - 1;
   for (; end >= 0; end--) {
    if (arr[end] !== "") break;
   }
   if (start > end) return [];
   return arr.slice(start, end - start + 1);
  }
  var fromParts = trim(from.split("/"));
  var toParts = trim(to.split("/"));
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
   outputParts.push("..");
  }
  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join("/");
 })
};
var TTY = {
 ttys: [],
 init: (function() {}),
 shutdown: (function() {}),
 register: (function(dev, ops) {
  TTY.ttys[dev] = {
   input: [],
   output: [],
   ops: ops
  };
  FS.registerDevice(dev, TTY.stream_ops);
 }),
 stream_ops: {
  open: (function(stream) {
   var tty = TTY.ttys[stream.node.rdev];
   if (!tty) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   stream.tty = tty;
   stream.seekable = false;
  }),
  close: (function(stream) {
   stream.tty.ops.flush(stream.tty);
  }),
  flush: (function(stream) {
   stream.tty.ops.flush(stream.tty);
  }),
  read: (function(stream, buffer, offset, length, pos) {
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
    buffer[offset + i] = result;
   }
   if (bytesRead) {
    stream.node.timestamp = Date.now();
   }
   return bytesRead;
  }),
  write: (function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.put_char) {
    throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
   }
   for (var i = 0; i < length; i++) {
    try {
     stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
    } catch (e) {
     throw new FS.ErrnoError(ERRNO_CODES.EIO);
    }
   }
   if (length) {
    stream.node.timestamp = Date.now();
   }
   return i;
  })
 },
 default_tty_ops: {
  get_char: (function(tty) {
   if (!tty.input.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
     var BUFSIZE = 256;
     var buf = new Buffer(BUFSIZE);
     var bytesRead = 0;
     var fd = process.stdin.fd;
     var usingDevice = false;
     try {
      fd = fs.openSync("/dev/stdin", "r");
      usingDevice = true;
     } catch (e) {}
     bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
     if (usingDevice) {
      fs.closeSync(fd);
     }
     if (bytesRead > 0) {
      result = buf.slice(0, bytesRead).toString("utf-8");
     } else {
      result = null;
     }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
     result = window.prompt("Input: ");
     if (result !== null) {
      result += "\n";
     }
    } else if (typeof readline == "function") {
     result = readline();
     if (result !== null) {
      result += "\n";
     }
    }
    if (!result) {
     return null;
    }
    tty.input = intArrayFromString(result, true);
   }
   return tty.input.shift();
  }),
  put_char: (function(tty, val) {
   if (val === null || val === 10) {
    Module["print"](UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  }),
  flush: (function(tty) {
   if (tty.output && tty.output.length > 0) {
    Module["print"](UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  })
 },
 default_tty1_ops: {
  put_char: (function(tty, val) {
   if (val === null || val === 10) {
    Module["printErr"](UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  }),
  flush: (function(tty) {
   if (tty.output && tty.output.length > 0) {
    Module["printErr"](UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  })
 }
};
var MEMFS = {
 ops_table: null,
 mount: (function(mount) {
  return MEMFS.createNode(null, "/", 16384 | 511, 0);
 }),
 createNode: (function(parent, name, mode, dev) {
  if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
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
   node.usedBytes = 0;
   node.contents = null;
  } else if (FS.isLink(node.mode)) {
   node.node_ops = MEMFS.ops_table.link.node;
   node.stream_ops = MEMFS.ops_table.link.stream;
  } else if (FS.isChrdev(node.mode)) {
   node.node_ops = MEMFS.ops_table.chrdev.node;
   node.stream_ops = MEMFS.ops_table.chrdev.stream;
  }
  node.timestamp = Date.now();
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 }),
 getFileDataAsRegularArray: (function(node) {
  if (node.contents && node.contents.subarray) {
   var arr = [];
   for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
   return arr;
  }
  return node.contents;
 }),
 getFileDataAsTypedArray: (function(node) {
  if (!node.contents) return new Uint8Array;
  if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
  return new Uint8Array(node.contents);
 }),
 expandFileStorage: (function(node, newCapacity) {
  if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
   node.contents = MEMFS.getFileDataAsRegularArray(node);
   node.usedBytes = node.contents.length;
  }
  if (!node.contents || node.contents.subarray) {
   var prevCapacity = node.contents ? node.contents.buffer.byteLength : 0;
   if (prevCapacity >= newCapacity) return;
   var CAPACITY_DOUBLING_MAX = 1024 * 1024;
   newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
   if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
   var oldContents = node.contents;
   node.contents = new Uint8Array(newCapacity);
   if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
   return;
  }
  if (!node.contents && newCapacity > 0) node.contents = [];
  while (node.contents.length < newCapacity) node.contents.push(0);
 }),
 resizeFileStorage: (function(node, newSize) {
  if (node.usedBytes == newSize) return;
  if (newSize == 0) {
   node.contents = null;
   node.usedBytes = 0;
   return;
  }
  if (!node.contents || node.contents.subarray) {
   var oldContents = node.contents;
   node.contents = new Uint8Array(new ArrayBuffer(newSize));
   if (oldContents) {
    node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
   }
   node.usedBytes = newSize;
   return;
  }
  if (!node.contents) node.contents = [];
  if (node.contents.length > newSize) node.contents.length = newSize; else while (node.contents.length < newSize) node.contents.push(0);
  node.usedBytes = newSize;
 }),
 node_ops: {
  getattr: (function(node) {
   var attr = {};
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
   attr.blksize = 4096;
   attr.blocks = Math.ceil(attr.size / attr.blksize);
   return attr;
  }),
  setattr: (function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
   if (attr.size !== undefined) {
    MEMFS.resizeFileStorage(node, attr.size);
   }
  }),
  lookup: (function(parent, name) {
   throw FS.genericErrors[ERRNO_CODES.ENOENT];
  }),
  mknod: (function(parent, name, mode, dev) {
   return MEMFS.createNode(parent, name, mode, dev);
  }),
  rename: (function(old_node, new_dir, new_name) {
   if (FS.isDir(old_node.mode)) {
    var new_node;
    try {
     new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (new_node) {
     for (var i in new_node.contents) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
     }
    }
   }
   delete old_node.parent.contents[old_node.name];
   old_node.name = new_name;
   new_dir.contents[new_name] = old_node;
   old_node.parent = new_dir;
  }),
  unlink: (function(parent, name) {
   delete parent.contents[name];
  }),
  rmdir: (function(parent, name) {
   var node = FS.lookupNode(parent, name);
   for (var i in node.contents) {
    throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
   }
   delete parent.contents[name];
  }),
  readdir: (function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  }),
  symlink: (function(parent, newname, oldpath) {
   var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
   node.link = oldpath;
   return node;
  }),
  readlink: (function(node) {
   if (!FS.isLink(node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return node.link;
  })
 },
 stream_ops: {
  read: (function(stream, buffer, offset, length, position) {
   var contents = stream.node.contents;
   if (position >= stream.node.usedBytes) return 0;
   var size = Math.min(stream.node.usedBytes - position, length);
   assert(size >= 0);
   if (size > 8 && contents.subarray) {
    buffer.set(contents.subarray(position, position + size), offset);
   } else {
    for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
   }
   return size;
  }),
  write: (function(stream, buffer, offset, length, position, canOwn) {
   if (!length) return 0;
   var node = stream.node;
   node.timestamp = Date.now();
   if (buffer.subarray && (!node.contents || node.contents.subarray)) {
    if (canOwn) {
     node.contents = buffer.subarray(offset, offset + length);
     node.usedBytes = length;
     return length;
    } else if (node.usedBytes === 0 && position === 0) {
     node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
     node.usedBytes = length;
     return length;
    } else if (position + length <= node.usedBytes) {
     node.contents.set(buffer.subarray(offset, offset + length), position);
     return length;
    }
   }
   MEMFS.expandFileStorage(node, position + length);
   if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); else {
    for (var i = 0; i < length; i++) {
     node.contents[position + i] = buffer[offset + i];
    }
   }
   node.usedBytes = Math.max(node.usedBytes, position + length);
   return length;
  }),
  llseek: (function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.usedBytes;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  }),
  allocate: (function(stream, offset, length) {
   MEMFS.expandFileStorage(stream.node, offset + length);
   stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
  }),
  mmap: (function(stream, buffer, offset, length, position, prot, flags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   var ptr;
   var allocated;
   var contents = stream.node.contents;
   if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
    allocated = false;
    ptr = contents.byteOffset;
   } else {
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
   return {
    ptr: ptr,
    allocated: allocated
   };
  }),
  msync: (function(stream, buffer, offset, length, mmapFlags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   if (mmapFlags & 2) {
    return 0;
   }
   var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
   return 0;
  })
 }
};
var IDBFS = {
 dbs: {},
 indexedDB: (function() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  var ret = null;
  if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  assert(ret, "IDBFS used, but indexedDB not supported");
  return ret;
 }),
 DB_VERSION: 21,
 DB_STORE_NAME: "FILE_DATA",
 mount: (function(mount) {
  return MEMFS.mount.apply(null, arguments);
 }),
 syncfs: (function(mount, populate, callback) {
  IDBFS.getLocalSet(mount, (function(err, local) {
   if (err) return callback(err);
   IDBFS.getRemoteSet(mount, (function(err, remote) {
    if (err) return callback(err);
    var src = populate ? remote : local;
    var dst = populate ? local : remote;
    IDBFS.reconcile(src, dst, callback);
   }));
  }));
 }),
 getDB: (function(name, callback) {
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
  req.onupgradeneeded = (function(e) {
   var db = e.target.result;
   var transaction = e.target.transaction;
   var fileStore;
   if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
    fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
   } else {
    fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
   }
   if (!fileStore.indexNames.contains("timestamp")) {
    fileStore.createIndex("timestamp", "timestamp", {
     unique: false
    });
   }
  });
  req.onsuccess = (function() {
   db = req.result;
   IDBFS.dbs[name] = db;
   callback(null, db);
  });
  req.onerror = (function(e) {
   callback(this.error);
   e.preventDefault();
  });
 }),
 getLocalSet: (function(mount, callback) {
  var entries = {};
  function isRealDir(p) {
   return p !== "." && p !== "..";
  }
  function toAbsolute(root) {
   return (function(p) {
    return PATH.join2(root, p);
   });
  }
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
   entries[path] = {
    timestamp: stat.mtime
   };
  }
  return callback(null, {
   type: "local",
   entries: entries
  });
 }),
 getRemoteSet: (function(mount, callback) {
  var entries = {};
  IDBFS.getDB(mount.mountpoint, (function(err, db) {
   if (err) return callback(err);
   var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readonly");
   transaction.onerror = (function(e) {
    callback(this.error);
    e.preventDefault();
   });
   var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
   var index = store.index("timestamp");
   index.openKeyCursor().onsuccess = (function(event) {
    var cursor = event.target.result;
    if (!cursor) {
     return callback(null, {
      type: "remote",
      db: db,
      entries: entries
     });
    }
    entries[cursor.primaryKey] = {
     timestamp: cursor.key
    };
    cursor.continue();
   });
  }));
 }),
 loadLocalEntry: (function(path, callback) {
  var stat, node;
  try {
   var lookup = FS.lookupPath(path);
   node = lookup.node;
   stat = FS.stat(path);
  } catch (e) {
   return callback(e);
  }
  if (FS.isDir(stat.mode)) {
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode
   });
  } else if (FS.isFile(stat.mode)) {
   node.contents = MEMFS.getFileDataAsTypedArray(node);
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode,
    contents: node.contents
   });
  } else {
   return callback(new Error("node type not supported"));
  }
 }),
 storeLocalEntry: (function(path, entry, callback) {
  try {
   if (FS.isDir(entry.mode)) {
    FS.mkdir(path, entry.mode);
   } else if (FS.isFile(entry.mode)) {
    FS.writeFile(path, entry.contents, {
     encoding: "binary",
     canOwn: true
    });
   } else {
    return callback(new Error("node type not supported"));
   }
   FS.chmod(path, entry.mode);
   FS.utime(path, entry.timestamp, entry.timestamp);
  } catch (e) {
   return callback(e);
  }
  callback(null);
 }),
 removeLocalEntry: (function(path, callback) {
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
 }),
 loadRemoteEntry: (function(store, path, callback) {
  var req = store.get(path);
  req.onsuccess = (function(event) {
   callback(null, event.target.result);
  });
  req.onerror = (function(e) {
   callback(this.error);
   e.preventDefault();
  });
 }),
 storeRemoteEntry: (function(store, path, entry, callback) {
  var req = store.put(entry, path);
  req.onsuccess = (function() {
   callback(null);
  });
  req.onerror = (function(e) {
   callback(this.error);
   e.preventDefault();
  });
 }),
 removeRemoteEntry: (function(store, path, callback) {
  var req = store.delete(path);
  req.onsuccess = (function() {
   callback(null);
  });
  req.onerror = (function(e) {
   callback(this.error);
   e.preventDefault();
  });
 }),
 reconcile: (function(src, dst, callback) {
  var total = 0;
  var create = [];
  Object.keys(src.entries).forEach((function(key) {
   var e = src.entries[key];
   var e2 = dst.entries[key];
   if (!e2 || e.timestamp > e2.timestamp) {
    create.push(key);
    total++;
   }
  }));
  var remove = [];
  Object.keys(dst.entries).forEach((function(key) {
   var e = dst.entries[key];
   var e2 = src.entries[key];
   if (!e2) {
    remove.push(key);
    total++;
   }
  }));
  if (!total) {
   return callback(null);
  }
  var errored = false;
  var completed = 0;
  var db = src.type === "remote" ? src.db : dst.db;
  var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readwrite");
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
  }
  transaction.onerror = (function(e) {
   done(this.error);
   e.preventDefault();
  });
  create.sort().forEach((function(path) {
   if (dst.type === "local") {
    IDBFS.loadRemoteEntry(store, path, (function(err, entry) {
     if (err) return done(err);
     IDBFS.storeLocalEntry(path, entry, done);
    }));
   } else {
    IDBFS.loadLocalEntry(path, (function(err, entry) {
     if (err) return done(err);
     IDBFS.storeRemoteEntry(store, path, entry, done);
    }));
   }
  }));
  remove.sort().reverse().forEach((function(path) {
   if (dst.type === "local") {
    IDBFS.removeLocalEntry(path, done);
   } else {
    IDBFS.removeRemoteEntry(store, path, done);
   }
  }));
 })
};
var NODEFS = {
 isWindows: false,
 staticInit: (function() {
  NODEFS.isWindows = !!process.platform.match(/^win/);
 }),
 mount: (function(mount) {
  assert(ENVIRONMENT_IS_NODE);
  return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
 }),
 createNode: (function(parent, name, mode, dev) {
  if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  var node = FS.createNode(parent, name, mode);
  node.node_ops = NODEFS.node_ops;
  node.stream_ops = NODEFS.stream_ops;
  return node;
 }),
 getMode: (function(path) {
  var stat;
  try {
   stat = fs.lstatSync(path);
   if (NODEFS.isWindows) {
    stat.mode = stat.mode | (stat.mode & 146) >> 1;
   }
  } catch (e) {
   if (!e.code) throw e;
   throw new FS.ErrnoError(ERRNO_CODES[e.code]);
  }
  return stat.mode;
 }),
 realPath: (function(node) {
  var parts = [];
  while (node.parent !== node) {
   parts.push(node.name);
   node = node.parent;
  }
  parts.push(node.mount.opts.root);
  parts.reverse();
  return PATH.join.apply(null, parts);
 }),
 flagsToPermissionStringMap: {
  0: "r",
  1: "r+",
  2: "r+",
  64: "r",
  65: "r+",
  66: "r+",
  129: "rx+",
  193: "rx+",
  514: "w+",
  577: "w",
  578: "w+",
  705: "wx",
  706: "wx+",
  1024: "a",
  1025: "a",
  1026: "a+",
  1089: "a",
  1090: "a+",
  1153: "ax",
  1154: "ax+",
  1217: "ax",
  1218: "ax+",
  4096: "rs",
  4098: "rs+"
 },
 flagsToPermissionString: (function(flags) {
  flags &= ~32768;
  if (flags in NODEFS.flagsToPermissionStringMap) {
   return NODEFS.flagsToPermissionStringMap[flags];
  } else {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
 }),
 node_ops: {
  getattr: (function(node) {
   var path = NODEFS.realPath(node);
   var stat;
   try {
    stat = fs.lstatSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   if (NODEFS.isWindows && !stat.blksize) {
    stat.blksize = 4096;
   }
   if (NODEFS.isWindows && !stat.blocks) {
    stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
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
  }),
  setattr: (function(node, attr) {
   var path = NODEFS.realPath(node);
   try {
    if (attr.mode !== undefined) {
     fs.chmodSync(path, attr.mode);
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
  }),
  lookup: (function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   var mode = NODEFS.getMode(path);
   return NODEFS.createNode(parent, name, mode);
  }),
  mknod: (function(parent, name, mode, dev) {
   var node = NODEFS.createNode(parent, name, mode, dev);
   var path = NODEFS.realPath(node);
   try {
    if (FS.isDir(node.mode)) {
     fs.mkdirSync(path, node.mode);
    } else {
     fs.writeFileSync(path, "", {
      mode: node.mode
     });
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   return node;
  }),
  rename: (function(oldNode, newDir, newName) {
   var oldPath = NODEFS.realPath(oldNode);
   var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
   try {
    fs.renameSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  unlink: (function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.unlinkSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  rmdir: (function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.rmdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  readdir: (function(node) {
   var path = NODEFS.realPath(node);
   try {
    return fs.readdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  symlink: (function(parent, newName, oldPath) {
   var newPath = PATH.join2(NODEFS.realPath(parent), newName);
   try {
    fs.symlinkSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  readlink: (function(node) {
   var path = NODEFS.realPath(node);
   try {
    path = fs.readlinkSync(path);
    path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
    return path;
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  })
 },
 stream_ops: {
  open: (function(stream) {
   var path = NODEFS.realPath(stream.node);
   try {
    if (FS.isFile(stream.node.mode)) {
     stream.nfd = fs.openSync(path, NODEFS.flagsToPermissionString(stream.flags));
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  close: (function(stream) {
   try {
    if (FS.isFile(stream.node.mode) && stream.nfd) {
     fs.closeSync(stream.nfd);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }),
  read: (function(stream, buffer, offset, length, position) {
   if (length === 0) return 0;
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
  }),
  write: (function(stream, buffer, offset, length, position) {
   var nbuffer = new Buffer(buffer.subarray(offset, offset + length));
   var res;
   try {
    res = fs.writeSync(stream.nfd, nbuffer, 0, length, position);
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   return res;
  }),
  llseek: (function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
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
  })
 }
};
var WORKERFS = {
 DIR_MODE: 16895,
 FILE_MODE: 33279,
 reader: null,
 mount: (function(mount) {
  assert(ENVIRONMENT_IS_WORKER);
  if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync;
  var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
  var createdParents = {};
  function ensureParent(path) {
   var parts = path.split("/");
   var parent = root;
   for (var i = 0; i < parts.length - 1; i++) {
    var curr = parts.slice(0, i + 1).join("/");
    if (!createdParents[curr]) {
     createdParents[curr] = WORKERFS.createNode(parent, curr, WORKERFS.DIR_MODE, 0);
    }
    parent = createdParents[curr];
   }
   return parent;
  }
  function base(path) {
   var parts = path.split("/");
   return parts[parts.length - 1];
  }
  Array.prototype.forEach.call(mount.opts["files"] || [], (function(file) {
   WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
  }));
  (mount.opts["blobs"] || []).forEach((function(obj) {
   WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
  }));
  (mount.opts["packages"] || []).forEach((function(pack) {
   pack["metadata"].files.forEach((function(file) {
    var name = file.filename.substr(1);
    WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end));
   }));
  }));
  return root;
 }),
 createNode: (function(parent, name, mode, dev, contents, mtime) {
  var node = FS.createNode(parent, name, mode);
  node.mode = mode;
  node.node_ops = WORKERFS.node_ops;
  node.stream_ops = WORKERFS.stream_ops;
  node.timestamp = (mtime || new Date).getTime();
  assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
  if (mode === WORKERFS.FILE_MODE) {
   node.size = contents.size;
   node.contents = contents;
  } else {
   node.size = 4096;
   node.contents = {};
  }
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 }),
 node_ops: {
  getattr: (function(node) {
   return {
    dev: 1,
    ino: undefined,
    mode: node.mode,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: undefined,
    size: node.size,
    atime: new Date(node.timestamp),
    mtime: new Date(node.timestamp),
    ctime: new Date(node.timestamp),
    blksize: 4096,
    blocks: Math.ceil(node.size / 4096)
   };
  }),
  setattr: (function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
  }),
  lookup: (function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }),
  mknod: (function(parent, name, mode, dev) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  rename: (function(oldNode, newDir, newName) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  unlink: (function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  rmdir: (function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  readdir: (function(node) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  symlink: (function(parent, newName, oldPath) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }),
  readlink: (function(node) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  })
 },
 stream_ops: {
  read: (function(stream, buffer, offset, length, position) {
   if (position >= stream.node.size) return 0;
   var chunk = stream.node.contents.slice(position, position + length);
   var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
   buffer.set(new Uint8Array(ab), offset);
   return chunk.size;
  }),
  write: (function(stream, buffer, offset, length, position) {
   throw new FS.ErrnoError(ERRNO_CODES.EIO);
  }),
  llseek: (function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.size;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  })
 }
};
var _stdin = allocate(1, "i32*", ALLOC_STATIC);
var _stdout = allocate(1, "i32*", ALLOC_STATIC);
var _stderr = allocate(1, "i32*", ALLOC_STATIC);
var FS = {
 root: null,
 mounts: [],
 devices: [ null ],
 streams: [],
 nextInode: 1,
 nameTable: null,
 currentPath: "/",
 initialized: false,
 ignorePermissions: true,
 trackingDelegate: {},
 tracking: {
  openFlags: {
   READ: 1,
   WRITE: 2
  }
 },
 ErrnoError: null,
 genericErrors: {},
 filesystems: null,
 handleFSError: (function(e) {
  if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
  return ___setErrNo(e.errno);
 }),
 lookupPath: (function(path, opts) {
  path = PATH.resolve(FS.cwd(), path);
  opts = opts || {};
  if (!path) return {
   path: "",
   node: null
  };
  var defaults = {
   follow_mount: true,
   recurse_count: 0
  };
  for (var key in defaults) {
   if (opts[key] === undefined) {
    opts[key] = defaults[key];
   }
  }
  if (opts.recurse_count > 8) {
   throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
  }
  var parts = PATH.normalizeArray(path.split("/").filter((function(p) {
   return !!p;
  })), false);
  var current = FS.root;
  var current_path = "/";
  for (var i = 0; i < parts.length; i++) {
   var islast = i === parts.length - 1;
   if (islast && opts.parent) {
    break;
   }
   current = FS.lookupNode(current, parts[i]);
   current_path = PATH.join2(current_path, parts[i]);
   if (FS.isMountpoint(current)) {
    if (!islast || islast && opts.follow_mount) {
     current = current.mounted.root;
    }
   }
   if (!islast || opts.follow) {
    var count = 0;
    while (FS.isLink(current.mode)) {
     var link = FS.readlink(current_path);
     current_path = PATH.resolve(PATH.dirname(current_path), link);
     var lookup = FS.lookupPath(current_path, {
      recurse_count: opts.recurse_count
     });
     current = lookup.node;
     if (count++ > 40) {
      throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
     }
    }
   }
  }
  return {
   path: current_path,
   node: current
  };
 }),
 getPath: (function(node) {
  var path;
  while (true) {
   if (FS.isRoot(node)) {
    var mount = node.mount.mountpoint;
    if (!path) return mount;
    return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
   }
   path = path ? node.name + "/" + path : node.name;
   node = node.parent;
  }
 }),
 hashName: (function(parentid, name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
   hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
  }
  return (parentid + hash >>> 0) % FS.nameTable.length;
 }),
 hashAddNode: (function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  node.name_next = FS.nameTable[hash];
  FS.nameTable[hash] = node;
 }),
 hashRemoveNode: (function(node) {
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
 }),
 lookupNode: (function(parent, name) {
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
  return FS.lookup(parent, name);
 }),
 createNode: (function(parent, name, mode, rdev) {
  if (!FS.FSNode) {
   FS.FSNode = (function(parent, name, mode, rdev) {
    if (!parent) {
     parent = this;
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
   });
   FS.FSNode.prototype = {};
   var readMode = 292 | 73;
   var writeMode = 146;
   Object.defineProperties(FS.FSNode.prototype, {
    read: {
     get: (function() {
      return (this.mode & readMode) === readMode;
     }),
     set: (function(val) {
      val ? this.mode |= readMode : this.mode &= ~readMode;
     })
    },
    write: {
     get: (function() {
      return (this.mode & writeMode) === writeMode;
     }),
     set: (function(val) {
      val ? this.mode |= writeMode : this.mode &= ~writeMode;
     })
    },
    isFolder: {
     get: (function() {
      return FS.isDir(this.mode);
     })
    },
    isDevice: {
     get: (function() {
      return FS.isChrdev(this.mode);
     })
    }
   });
  }
  var node = new FS.FSNode(parent, name, mode, rdev);
  FS.hashAddNode(node);
  return node;
 }),
 destroyNode: (function(node) {
  FS.hashRemoveNode(node);
 }),
 isRoot: (function(node) {
  return node === node.parent;
 }),
 isMountpoint: (function(node) {
  return !!node.mounted;
 }),
 isFile: (function(mode) {
  return (mode & 61440) === 32768;
 }),
 isDir: (function(mode) {
  return (mode & 61440) === 16384;
 }),
 isLink: (function(mode) {
  return (mode & 61440) === 40960;
 }),
 isChrdev: (function(mode) {
  return (mode & 61440) === 8192;
 }),
 isBlkdev: (function(mode) {
  return (mode & 61440) === 24576;
 }),
 isFIFO: (function(mode) {
  return (mode & 61440) === 4096;
 }),
 isSocket: (function(mode) {
  return (mode & 49152) === 49152;
 }),
 flagModes: {
  "r": 0,
  "rs": 1052672,
  "r+": 2,
  "w": 577,
  "wx": 705,
  "xw": 705,
  "w+": 578,
  "wx+": 706,
  "xw+": 706,
  "a": 1089,
  "ax": 1217,
  "xa": 1217,
  "a+": 1090,
  "ax+": 1218,
  "xa+": 1218
 },
 modeStringToFlags: (function(str) {
  var flags = FS.flagModes[str];
  if (typeof flags === "undefined") {
   throw new Error("Unknown file open mode: " + str);
  }
  return flags;
 }),
 flagsToPermissionString: (function(flag) {
  var perms = [ "r", "w", "rw" ][flag & 3];
  if (flag & 512) {
   perms += "w";
  }
  return perms;
 }),
 nodePermissions: (function(node, perms) {
  if (FS.ignorePermissions) {
   return 0;
  }
  if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
   return ERRNO_CODES.EACCES;
  } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
   return ERRNO_CODES.EACCES;
  } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
   return ERRNO_CODES.EACCES;
  }
  return 0;
 }),
 mayLookup: (function(dir) {
  var err = FS.nodePermissions(dir, "x");
  if (err) return err;
  if (!dir.node_ops.lookup) return ERRNO_CODES.EACCES;
  return 0;
 }),
 mayCreate: (function(dir, name) {
  try {
   var node = FS.lookupNode(dir, name);
   return ERRNO_CODES.EEXIST;
  } catch (e) {}
  return FS.nodePermissions(dir, "wx");
 }),
 mayDelete: (function(dir, name, isdir) {
  var node;
  try {
   node = FS.lookupNode(dir, name);
  } catch (e) {
   return e.errno;
  }
  var err = FS.nodePermissions(dir, "wx");
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
 }),
 mayOpen: (function(node, flags) {
  if (!node) {
   return ERRNO_CODES.ENOENT;
  }
  if (FS.isLink(node.mode)) {
   return ERRNO_CODES.ELOOP;
  } else if (FS.isDir(node.mode)) {
   if ((flags & 2097155) !== 0 || flags & 512) {
    return ERRNO_CODES.EISDIR;
   }
  }
  return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
 }),
 MAX_OPEN_FDS: 4096,
 nextfd: (function(fd_start, fd_end) {
  fd_start = fd_start || 0;
  fd_end = fd_end || FS.MAX_OPEN_FDS;
  for (var fd = fd_start; fd <= fd_end; fd++) {
   if (!FS.streams[fd]) {
    return fd;
   }
  }
  throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
 }),
 getStream: (function(fd) {
  return FS.streams[fd];
 }),
 createStream: (function(stream, fd_start, fd_end) {
  if (!FS.FSStream) {
   FS.FSStream = (function() {});
   FS.FSStream.prototype = {};
   Object.defineProperties(FS.FSStream.prototype, {
    object: {
     get: (function() {
      return this.node;
     }),
     set: (function(val) {
      this.node = val;
     })
    },
    isRead: {
     get: (function() {
      return (this.flags & 2097155) !== 1;
     })
    },
    isWrite: {
     get: (function() {
      return (this.flags & 2097155) !== 0;
     })
    },
    isAppend: {
     get: (function() {
      return this.flags & 1024;
     })
    }
   });
  }
  var newStream = new FS.FSStream;
  for (var p in stream) {
   newStream[p] = stream[p];
  }
  stream = newStream;
  var fd = FS.nextfd(fd_start, fd_end);
  stream.fd = fd;
  FS.streams[fd] = stream;
  return stream;
 }),
 closeStream: (function(fd) {
  FS.streams[fd] = null;
 }),
 chrdev_stream_ops: {
  open: (function(stream) {
   var device = FS.getDevice(stream.node.rdev);
   stream.stream_ops = device.stream_ops;
   if (stream.stream_ops.open) {
    stream.stream_ops.open(stream);
   }
  }),
  llseek: (function() {
   throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
  })
 },
 major: (function(dev) {
  return dev >> 8;
 }),
 minor: (function(dev) {
  return dev & 255;
 }),
 makedev: (function(ma, mi) {
  return ma << 8 | mi;
 }),
 registerDevice: (function(dev, ops) {
  FS.devices[dev] = {
   stream_ops: ops
  };
 }),
 getDevice: (function(dev) {
  return FS.devices[dev];
 }),
 getMounts: (function(mount) {
  var mounts = [];
  var check = [ mount ];
  while (check.length) {
   var m = check.pop();
   mounts.push(m);
   check.push.apply(check, m.mounts);
  }
  return mounts;
 }),
 syncfs: (function(populate, callback) {
  if (typeof populate === "function") {
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
  }
  mounts.forEach((function(mount) {
   if (!mount.type.syncfs) {
    return done(null);
   }
   mount.type.syncfs(mount, populate, done);
  }));
 }),
 mount: (function(type, opts, mountpoint) {
  var root = mountpoint === "/";
  var pseudo = !mountpoint;
  var node;
  if (root && FS.root) {
   throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
  } else if (!root && !pseudo) {
   var lookup = FS.lookupPath(mountpoint, {
    follow_mount: false
   });
   mountpoint = lookup.path;
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
  var mountRoot = type.mount(mount);
  mountRoot.mount = mount;
  mount.root = mountRoot;
  if (root) {
   FS.root = mountRoot;
  } else if (node) {
   node.mounted = mount;
   if (node.mount) {
    node.mount.mounts.push(mount);
   }
  }
  return mountRoot;
 }),
 unmount: (function(mountpoint) {
  var lookup = FS.lookupPath(mountpoint, {
   follow_mount: false
  });
  if (!FS.isMountpoint(lookup.node)) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  var node = lookup.node;
  var mount = node.mounted;
  var mounts = FS.getMounts(mount);
  Object.keys(FS.nameTable).forEach((function(hash) {
   var current = FS.nameTable[hash];
   while (current) {
    var next = current.name_next;
    if (mounts.indexOf(current.mount) !== -1) {
     FS.destroyNode(current);
    }
    current = next;
   }
  }));
  node.mounted = null;
  var idx = node.mount.mounts.indexOf(mount);
  assert(idx !== -1);
  node.mount.mounts.splice(idx, 1);
 }),
 lookup: (function(parent, name) {
  return parent.node_ops.lookup(parent, name);
 }),
 mknod: (function(path, mode, dev) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  if (!name || name === "." || name === "..") {
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
 }),
 create: (function(path, mode) {
  mode = mode !== undefined ? mode : 438;
  mode &= 4095;
  mode |= 32768;
  return FS.mknod(path, mode, 0);
 }),
 mkdir: (function(path, mode) {
  mode = mode !== undefined ? mode : 511;
  mode &= 511 | 512;
  mode |= 16384;
  return FS.mknod(path, mode, 0);
 }),
 mkdev: (function(path, mode, dev) {
  if (typeof dev === "undefined") {
   dev = mode;
   mode = 438;
  }
  mode |= 8192;
  return FS.mknod(path, mode, dev);
 }),
 symlink: (function(oldpath, newpath) {
  if (!PATH.resolve(oldpath)) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }
  var lookup = FS.lookupPath(newpath, {
   parent: true
  });
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
 }),
 rename: (function(old_path, new_path) {
  var old_dirname = PATH.dirname(old_path);
  var new_dirname = PATH.dirname(new_path);
  var old_name = PATH.basename(old_path);
  var new_name = PATH.basename(new_path);
  var lookup, old_dir, new_dir;
  try {
   lookup = FS.lookupPath(old_path, {
    parent: true
   });
   old_dir = lookup.node;
   lookup = FS.lookupPath(new_path, {
    parent: true
   });
   new_dir = lookup.node;
  } catch (e) {
   throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
  }
  if (!old_dir || !new_dir) throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  if (old_dir.mount !== new_dir.mount) {
   throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
  }
  var old_node = FS.lookupNode(old_dir, old_name);
  var relative = PATH.relative(old_path, new_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  relative = PATH.relative(new_path, old_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
  }
  var new_node;
  try {
   new_node = FS.lookupNode(new_dir, new_name);
  } catch (e) {}
  if (old_node === new_node) {
   return;
  }
  var isdir = FS.isDir(old_node.mode);
  var err = FS.mayDelete(old_dir, old_name, isdir);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!old_dir.node_ops.rename) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
   throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
  }
  if (new_dir !== old_dir) {
   err = FS.nodePermissions(old_dir, "w");
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  try {
   if (FS.trackingDelegate["willMovePath"]) {
    FS.trackingDelegate["willMovePath"](old_path, new_path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
  FS.hashRemoveNode(old_node);
  try {
   old_dir.node_ops.rename(old_node, new_dir, new_name);
  } catch (e) {
   throw e;
  } finally {
   FS.hashAddNode(old_node);
  }
  try {
   if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path);
  } catch (e) {
   console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
 }),
 rmdir: (function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
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
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.rmdir(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 }),
 readdir: (function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  if (!node.node_ops.readdir) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
  }
  return node.node_ops.readdir(node);
 }),
 unlink: (function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, false);
  if (err) {
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
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.unlink(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 }),
 readlink: (function(path) {
  var lookup = FS.lookupPath(path);
  var link = lookup.node;
  if (!link) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }
  if (!link.node_ops.readlink) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
 }),
 stat: (function(path, dontFollow) {
  var lookup = FS.lookupPath(path, {
   follow: !dontFollow
  });
  var node = lookup.node;
  if (!node) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }
  if (!node.node_ops.getattr) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  return node.node_ops.getattr(node);
 }),
 lstat: (function(path) {
  return FS.stat(path, true);
 }),
 chmod: (function(path, mode, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  node.node_ops.setattr(node, {
   mode: mode & 4095 | node.mode & ~4095,
   timestamp: Date.now()
  });
 }),
 lchmod: (function(path, mode) {
  FS.chmod(path, mode, true);
 }),
 fchmod: (function(fd, mode) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  }
  FS.chmod(stream.node, mode);
 }),
 chown: (function(path, uid, gid, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  node.node_ops.setattr(node, {
   timestamp: Date.now()
  });
 }),
 lchown: (function(path, uid, gid) {
  FS.chown(path, uid, gid, true);
 }),
 fchown: (function(fd, uid, gid) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  }
  FS.chown(stream.node, uid, gid);
 }),
 truncate: (function(path, len) {
  if (len < 0) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: true
   });
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
  var err = FS.nodePermissions(node, "w");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  node.node_ops.setattr(node, {
   size: len,
   timestamp: Date.now()
  });
 }),
 ftruncate: (function(fd, len) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  FS.truncate(stream.node, len);
 }),
 utime: (function(path, atime, mtime) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  node.node_ops.setattr(node, {
   timestamp: Math.max(atime, mtime)
  });
 }),
 open: (function(path, flags, mode, fd_start, fd_end) {
  if (path === "") {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }
  flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
  mode = typeof mode === "undefined" ? 438 : mode;
  if (flags & 64) {
   mode = mode & 4095 | 32768;
  } else {
   mode = 0;
  }
  var node;
  if (typeof path === "object") {
   node = path;
  } else {
   path = PATH.normalize(path);
   try {
    var lookup = FS.lookupPath(path, {
     follow: !(flags & 131072)
    });
    node = lookup.node;
   } catch (e) {}
  }
  var created = false;
  if (flags & 64) {
   if (node) {
    if (flags & 128) {
     throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
    }
   } else {
    node = FS.mknod(path, mode, 0);
    created = true;
   }
  }
  if (!node) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  }
  if (FS.isChrdev(node.mode)) {
   flags &= ~512;
  }
  if (flags & 65536 && !FS.isDir(node.mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
  }
  if (!created) {
   var err = FS.mayOpen(node, flags);
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  if (flags & 512) {
   FS.truncate(node, 0);
  }
  flags &= ~(128 | 512);
  var stream = FS.createStream({
   node: node,
   path: FS.getPath(node),
   flags: flags,
   seekable: true,
   position: 0,
   stream_ops: node.stream_ops,
   ungotten: [],
   error: false
  }, fd_start, fd_end);
  if (stream.stream_ops.open) {
   stream.stream_ops.open(stream);
  }
  if (Module["logReadFiles"] && !(flags & 1)) {
   if (!FS.readFiles) FS.readFiles = {};
   if (!(path in FS.readFiles)) {
    FS.readFiles[path] = 1;
    Module["printErr"]("read file: " + path);
   }
  }
  try {
   if (FS.trackingDelegate["onOpenFile"]) {
    var trackingFlags = 0;
    if ((flags & 2097155) !== 1) {
     trackingFlags |= FS.tracking.openFlags.READ;
    }
    if ((flags & 2097155) !== 0) {
     trackingFlags |= FS.tracking.openFlags.WRITE;
    }
    FS.trackingDelegate["onOpenFile"](path, trackingFlags);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
  }
  return stream;
 }),
 close: (function(stream) {
  if (stream.getdents) stream.getdents = null;
  try {
   if (stream.stream_ops.close) {
    stream.stream_ops.close(stream);
   }
  } catch (e) {
   throw e;
  } finally {
   FS.closeStream(stream.fd);
  }
 }),
 llseek: (function(stream, offset, whence) {
  if (!stream.seekable || !stream.stream_ops.llseek) {
   throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
  }
  stream.position = stream.stream_ops.llseek(stream, offset, whence);
  stream.ungotten = [];
  return stream.position;
 }),
 read: (function(stream, buffer, offset, length, position) {
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
  if (typeof position === "undefined") {
   position = stream.position;
   seeking = false;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
  }
  var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
  if (!seeking) stream.position += bytesRead;
  return bytesRead;
 }),
 write: (function(stream, buffer, offset, length, position, canOwn) {
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
   FS.llseek(stream, 0, 2);
  }
  var seeking = true;
  if (typeof position === "undefined") {
   position = stream.position;
   seeking = false;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
  }
  var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
  if (!seeking) stream.position += bytesWritten;
  try {
   if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path);
  } catch (e) {
   console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message);
  }
  return bytesWritten;
 }),
 allocate: (function(stream, offset, length) {
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
 }),
 mmap: (function(stream, buffer, offset, length, position, prot, flags) {
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(ERRNO_CODES.EACCES);
  }
  if (!stream.stream_ops.mmap) {
   throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
  }
  return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
 }),
 msync: (function(stream, buffer, offset, length, mmapFlags) {
  if (!stream || !stream.stream_ops.msync) {
   return 0;
  }
  return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
 }),
 munmap: (function(stream) {
  return 0;
 }),
 ioctl: (function(stream, cmd, arg) {
  if (!stream.stream_ops.ioctl) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
  }
  return stream.stream_ops.ioctl(stream, cmd, arg);
 }),
 readFile: (function(path, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "r";
  opts.encoding = opts.encoding || "binary";
  if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
   throw new Error('Invalid encoding type "' + opts.encoding + '"');
  }
  var ret;
  var stream = FS.open(path, opts.flags);
  var stat = FS.stat(path);
  var length = stat.size;
  var buf = new Uint8Array(length);
  FS.read(stream, buf, 0, length, 0);
  if (opts.encoding === "utf8") {
   ret = UTF8ArrayToString(buf, 0);
  } else if (opts.encoding === "binary") {
   ret = buf;
  }
  FS.close(stream);
  return ret;
 }),
 writeFile: (function(path, data, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "w";
  opts.encoding = opts.encoding || "utf8";
  if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
   throw new Error('Invalid encoding type "' + opts.encoding + '"');
  }
  var stream = FS.open(path, opts.flags, opts.mode);
  if (opts.encoding === "utf8") {
   var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
   var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
   FS.write(stream, buf, 0, actualNumBytes, 0, opts.canOwn);
  } else if (opts.encoding === "binary") {
   FS.write(stream, data, 0, data.length, 0, opts.canOwn);
  }
  FS.close(stream);
 }),
 cwd: (function() {
  return FS.currentPath;
 }),
 chdir: (function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  if (!FS.isDir(lookup.node.mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
  }
  var err = FS.nodePermissions(lookup.node, "x");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  FS.currentPath = lookup.path;
 }),
 createDefaultDirectories: (function() {
  FS.mkdir("/tmp");
  FS.mkdir("/home");
  FS.mkdir("/home/web_user");
 }),
 createDefaultDevices: (function() {
  FS.mkdir("/dev");
  FS.registerDevice(FS.makedev(1, 3), {
   read: (function() {
    return 0;
   }),
   write: (function(stream, buffer, offset, length, pos) {
    return length;
   })
  });
  FS.mkdev("/dev/null", FS.makedev(1, 3));
  TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
  TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
  FS.mkdev("/dev/tty", FS.makedev(5, 0));
  FS.mkdev("/dev/tty1", FS.makedev(6, 0));
  var random_device;
  if (typeof crypto !== "undefined") {
   var randomBuffer = new Uint8Array(1);
   random_device = (function() {
    crypto.getRandomValues(randomBuffer);
    return randomBuffer[0];
   });
  } else if (ENVIRONMENT_IS_NODE) {
   random_device = (function() {
    return require("crypto").randomBytes(1)[0];
   });
  } else {
   random_device = (function() {
    return Math.random() * 256 | 0;
   });
  }
  FS.createDevice("/dev", "random", random_device);
  FS.createDevice("/dev", "urandom", random_device);
  FS.mkdir("/dev/shm");
  FS.mkdir("/dev/shm/tmp");
 }),
 createSpecialDirectories: (function() {
  FS.mkdir("/proc");
  FS.mkdir("/proc/self");
  FS.mkdir("/proc/self/fd");
  FS.mount({
   mount: (function() {
    var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
    node.node_ops = {
     lookup: (function(parent, name) {
      var fd = +name;
      var stream = FS.getStream(fd);
      if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
      var ret = {
       parent: null,
       mount: {
        mountpoint: "fake"
       },
       node_ops: {
        readlink: (function() {
         return stream.path;
        })
       }
      };
      ret.parent = ret;
      return ret;
     })
    };
    return node;
   })
  }, {}, "/proc/self/fd");
 }),
 createStandardStreams: (function() {
  if (Module["stdin"]) {
   FS.createDevice("/dev", "stdin", Module["stdin"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdin");
  }
  if (Module["stdout"]) {
   FS.createDevice("/dev", "stdout", null, Module["stdout"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdout");
  }
  if (Module["stderr"]) {
   FS.createDevice("/dev", "stderr", null, Module["stderr"]);
  } else {
   FS.symlink("/dev/tty1", "/dev/stderr");
  }
  var stdin = FS.open("/dev/stdin", "r");
  assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
  var stdout = FS.open("/dev/stdout", "w");
  assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
  var stderr = FS.open("/dev/stderr", "w");
  assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
 }),
 ensureErrnoError: (function() {
  if (FS.ErrnoError) return;
  FS.ErrnoError = function ErrnoError(errno, node) {
   this.node = node;
   this.setErrno = (function(errno) {
    this.errno = errno;
    for (var key in ERRNO_CODES) {
     if (ERRNO_CODES[key] === errno) {
      this.code = key;
      break;
     }
    }
   });
   this.setErrno(errno);
   this.message = ERRNO_MESSAGES[errno];
  };
  FS.ErrnoError.prototype = new Error;
  FS.ErrnoError.prototype.constructor = FS.ErrnoError;
  [ ERRNO_CODES.ENOENT ].forEach((function(code) {
   FS.genericErrors[code] = new FS.ErrnoError(code);
   FS.genericErrors[code].stack = "<generic error, no stack>";
  }));
 }),
 staticInit: (function() {
  FS.ensureErrnoError();
  FS.nameTable = new Array(4096);
  FS.mount(MEMFS, {}, "/");
  FS.createDefaultDirectories();
  FS.createDefaultDevices();
  FS.createSpecialDirectories();
  FS.filesystems = {
   "MEMFS": MEMFS,
   "IDBFS": IDBFS,
   "NODEFS": NODEFS,
   "WORKERFS": WORKERFS
  };
 }),
 init: (function(input, output, error) {
  assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
  FS.init.initialized = true;
  FS.ensureErrnoError();
  Module["stdin"] = input || Module["stdin"];
  Module["stdout"] = output || Module["stdout"];
  Module["stderr"] = error || Module["stderr"];
  FS.createStandardStreams();
 }),
 quit: (function() {
  FS.init.initialized = false;
  var fflush = Module["_fflush"];
  if (fflush) fflush(0);
  for (var i = 0; i < FS.streams.length; i++) {
   var stream = FS.streams[i];
   if (!stream) {
    continue;
   }
   FS.close(stream);
  }
 }),
 getMode: (function(canRead, canWrite) {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
 }),
 joinPath: (function(parts, forceRelative) {
  var path = PATH.join.apply(null, parts);
  if (forceRelative && path[0] == "/") path = path.substr(1);
  return path;
 }),
 absolutePath: (function(relative, base) {
  return PATH.resolve(base, relative);
 }),
 standardizePath: (function(path) {
  return PATH.normalize(path);
 }),
 findObject: (function(path, dontResolveLastLink) {
  var ret = FS.analyzePath(path, dontResolveLastLink);
  if (ret.exists) {
   return ret.object;
  } else {
   ___setErrNo(ret.error);
   return null;
  }
 }),
 analyzePath: (function(path, dontResolveLastLink) {
  try {
   var lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   path = lookup.path;
  } catch (e) {}
  var ret = {
   isRoot: false,
   exists: false,
   error: 0,
   name: null,
   path: null,
   object: null,
   parentExists: false,
   parentPath: null,
   parentObject: null
  };
  try {
   var lookup = FS.lookupPath(path, {
    parent: true
   });
   ret.parentExists = true;
   ret.parentPath = lookup.path;
   ret.parentObject = lookup.node;
   ret.name = PATH.basename(path);
   lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   ret.exists = true;
   ret.path = lookup.path;
   ret.object = lookup.node;
   ret.name = lookup.node.name;
   ret.isRoot = lookup.path === "/";
  } catch (e) {
   ret.error = e.errno;
  }
  return ret;
 }),
 createFolder: (function(parent, name, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.mkdir(path, mode);
 }),
 createPath: (function(parent, path, canRead, canWrite) {
  parent = typeof parent === "string" ? parent : FS.getPath(parent);
  var parts = path.split("/").reverse();
  while (parts.length) {
   var part = parts.pop();
   if (!part) continue;
   var current = PATH.join2(parent, part);
   try {
    FS.mkdir(current);
   } catch (e) {}
   parent = current;
  }
  return current;
 }),
 createFile: (function(parent, name, properties, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.create(path, mode);
 }),
 createDataFile: (function(parent, name, data, canRead, canWrite, canOwn) {
  var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
  var mode = FS.getMode(canRead, canWrite);
  var node = FS.create(path, mode);
  if (data) {
   if (typeof data === "string") {
    var arr = new Array(data.length);
    for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
    data = arr;
   }
   FS.chmod(node, mode | 146);
   var stream = FS.open(node, "w");
   FS.write(stream, data, 0, data.length, 0, canOwn);
   FS.close(stream);
   FS.chmod(node, mode);
  }
  return node;
 }),
 createDevice: (function(parent, name, input, output) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(!!input, !!output);
  if (!FS.createDevice.major) FS.createDevice.major = 64;
  var dev = FS.makedev(FS.createDevice.major++, 0);
  FS.registerDevice(dev, {
   open: (function(stream) {
    stream.seekable = false;
   }),
   close: (function(stream) {
    if (output && output.buffer && output.buffer.length) {
     output(10);
    }
   }),
   read: (function(stream, buffer, offset, length, pos) {
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
     buffer[offset + i] = result;
    }
    if (bytesRead) {
     stream.node.timestamp = Date.now();
    }
    return bytesRead;
   }),
   write: (function(stream, buffer, offset, length, pos) {
    for (var i = 0; i < length; i++) {
     try {
      output(buffer[offset + i]);
     } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES.EIO);
     }
    }
    if (length) {
     stream.node.timestamp = Date.now();
    }
    return i;
   })
  });
  return FS.mkdev(path, mode, dev);
 }),
 createLink: (function(parent, name, target, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  return FS.symlink(target, path);
 }),
 forceLoadFile: (function(obj) {
  if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
  var success = true;
  if (typeof XMLHttpRequest !== "undefined") {
   throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
  } else if (Module["read"]) {
   try {
    obj.contents = intArrayFromString(Module["read"](obj.url), true);
    obj.usedBytes = obj.contents.length;
   } catch (e) {
    success = false;
   }
  } else {
   throw new Error("Cannot load without read() or XMLHttpRequest.");
  }
  if (!success) ___setErrNo(ERRNO_CODES.EIO);
  return success;
 }),
 createLazyFile: (function(parent, name, url, canRead, canWrite) {
  function LazyUint8Array() {
   this.lengthKnown = false;
   this.chunks = [];
  }
  LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
   if (idx > this.length - 1 || idx < 0) {
    return undefined;
   }
   var chunkOffset = idx % this.chunkSize;
   var chunkNum = idx / this.chunkSize | 0;
   return this.getter(chunkNum)[chunkOffset];
  };
  LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
   this.getter = getter;
  };
  LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
   var xhr = new XMLHttpRequest;
   xhr.open("HEAD", url, false);
   xhr.send(null);
   if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
   var datalength = Number(xhr.getResponseHeader("Content-length"));
   var header;
   var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
   var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
   var chunkSize = 1024 * 1024;
   if (!hasByteServing) chunkSize = datalength;
   var doXHR = (function(from, to) {
    if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
    var xhr = new XMLHttpRequest;
    xhr.open("GET", url, false);
    if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
    if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
    if (xhr.overrideMimeType) {
     xhr.overrideMimeType("text/plain; charset=x-user-defined");
    }
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
    if (xhr.response !== undefined) {
     return new Uint8Array(xhr.response || []);
    } else {
     return intArrayFromString(xhr.responseText || "", true);
    }
   });
   var lazyArray = this;
   lazyArray.setDataGetter((function(chunkNum) {
    var start = chunkNum * chunkSize;
    var end = (chunkNum + 1) * chunkSize - 1;
    end = Math.min(end, datalength - 1);
    if (typeof lazyArray.chunks[chunkNum] === "undefined") {
     lazyArray.chunks[chunkNum] = doXHR(start, end);
    }
    if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
    return lazyArray.chunks[chunkNum];
   }));
   if (usesGzip || !datalength) {
    chunkSize = datalength = 1;
    datalength = this.getter(0).length;
    chunkSize = datalength;
    console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
   }
   this._length = datalength;
   this._chunkSize = chunkSize;
   this.lengthKnown = true;
  };
  if (typeof XMLHttpRequest !== "undefined") {
   if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
   var lazyArray = new LazyUint8Array;
   Object.defineProperties(lazyArray, {
    length: {
     get: (function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._length;
     })
    },
    chunkSize: {
     get: (function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._chunkSize;
     })
    }
   });
   var properties = {
    isDevice: false,
    contents: lazyArray
   };
  } else {
   var properties = {
    isDevice: false,
    url: url
   };
  }
  var node = FS.createFile(parent, name, properties, canRead, canWrite);
  if (properties.contents) {
   node.contents = properties.contents;
  } else if (properties.url) {
   node.contents = null;
   node.url = properties.url;
  }
  Object.defineProperties(node, {
   usedBytes: {
    get: (function() {
     return this.contents.length;
    })
   }
  });
  var stream_ops = {};
  var keys = Object.keys(node.stream_ops);
  keys.forEach((function(key) {
   var fn = node.stream_ops[key];
   stream_ops[key] = function forceLoadLazyFile() {
    if (!FS.forceLoadFile(node)) {
     throw new FS.ErrnoError(ERRNO_CODES.EIO);
    }
    return fn.apply(null, arguments);
   };
  }));
  stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
   if (!FS.forceLoadFile(node)) {
    throw new FS.ErrnoError(ERRNO_CODES.EIO);
   }
   var contents = stream.node.contents;
   if (position >= contents.length) return 0;
   var size = Math.min(contents.length - position, length);
   assert(size >= 0);
   if (contents.slice) {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents[position + i];
    }
   } else {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents.get(position + i);
    }
   }
   return size;
  };
  node.stream_ops = stream_ops;
  return node;
 }),
 createPreloadedFile: (function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
  Browser.init();
  var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency("cp " + fullname);
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
   Module["preloadPlugins"].forEach((function(plugin) {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
     plugin["handle"](byteArray, fullname, finish, (function() {
      if (onerror) onerror();
      removeRunDependency(dep);
     }));
     handled = true;
    }
   }));
   if (!handled) finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
   Browser.asyncLoad(url, (function(byteArray) {
    processData(byteArray);
   }), onerror);
  } else {
   processData(url);
  }
 }),
 indexedDB: (function() {
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
 }),
 DB_NAME: (function() {
  return "EM_FS_" + window.location.pathname;
 }),
 DB_VERSION: 20,
 DB_STORE_NAME: "FILE_DATA",
 saveFilesToDB: (function(paths, onload, onerror) {
  onload = onload || (function() {});
  onerror = onerror || (function() {});
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
   console.log("creating db");
   var db = openRequest.result;
   db.createObjectStore(FS.DB_STORE_NAME);
  };
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   var transaction = db.transaction([ FS.DB_STORE_NAME ], "readwrite");
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach((function(path) {
    var putRequest = files.put(FS.analyzePath(path).object.contents, path);
    putRequest.onsuccess = function putRequest_onsuccess() {
     ok++;
     if (ok + fail == total) finish();
    };
    putRequest.onerror = function putRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   }));
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 }),
 loadFilesFromDB: (function(paths, onload, onerror) {
  onload = onload || (function() {});
  onerror = onerror || (function() {});
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = onerror;
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   try {
    var transaction = db.transaction([ FS.DB_STORE_NAME ], "readonly");
   } catch (e) {
    onerror(e);
    return;
   }
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach((function(path) {
    var getRequest = files.get(path);
    getRequest.onsuccess = function getRequest_onsuccess() {
     if (FS.analyzePath(path).exists) {
      FS.unlink(path);
     }
     FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
     ok++;
     if (ok + fail == total) finish();
    };
    getRequest.onerror = function getRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   }));
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 })
};
var SYSCALLS = {
 DEFAULT_POLLMASK: 5,
 mappings: {},
 umask: 511,
 calculateAt: (function(dirfd, path) {
  if (path[0] !== "/") {
   var dir;
   if (dirfd === -100) {
    dir = FS.cwd();
   } else {
    var dirstream = FS.getStream(dirfd);
    if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    dir = dirstream.path;
   }
   path = PATH.join2(dir, path);
  }
  return path;
 }),
 doStat: (function(func, path, buf) {
  try {
   var stat = func(path);
  } catch (e) {
   if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
    return -ERRNO_CODES.ENOTDIR;
   }
   throw e;
  }
  HEAP32[buf >> 2] = stat.dev;
  HEAP32[buf + 4 >> 2] = 0;
  HEAP32[buf + 8 >> 2] = stat.ino;
  HEAP32[buf + 12 >> 2] = stat.mode;
  HEAP32[buf + 16 >> 2] = stat.nlink;
  HEAP32[buf + 20 >> 2] = stat.uid;
  HEAP32[buf + 24 >> 2] = stat.gid;
  HEAP32[buf + 28 >> 2] = stat.rdev;
  HEAP32[buf + 32 >> 2] = 0;
  HEAP32[buf + 36 >> 2] = stat.size;
  HEAP32[buf + 40 >> 2] = 4096;
  HEAP32[buf + 44 >> 2] = stat.blocks;
  HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
  HEAP32[buf + 52 >> 2] = 0;
  HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
  HEAP32[buf + 60 >> 2] = 0;
  HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
  HEAP32[buf + 68 >> 2] = 0;
  HEAP32[buf + 72 >> 2] = stat.ino;
  return 0;
 }),
 doMsync: (function(addr, stream, len, flags) {
  var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
  FS.msync(stream, buffer, 0, len, flags);
 }),
 doMkdir: (function(path, mode) {
  path = PATH.normalize(path);
  if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
  FS.mkdir(path, mode, 0);
  return 0;
 }),
 doMknod: (function(path, mode, dev) {
  switch (mode & 61440) {
  case 32768:
  case 8192:
  case 24576:
  case 4096:
  case 49152:
   break;
  default:
   return -ERRNO_CODES.EINVAL;
  }
  FS.mknod(path, mode, dev);
  return 0;
 }),
 doReadlink: (function(path, buf, bufsize) {
  if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
  var ret = FS.readlink(path);
  ret = ret.slice(0, Math.max(0, bufsize));
  writeStringToMemory(ret, buf, true);
  return ret.length;
 }),
 doAccess: (function(path, amode) {
  if (amode & ~7) {
   return -ERRNO_CODES.EINVAL;
  }
  var node;
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  node = lookup.node;
  var perms = "";
  if (amode & 4) perms += "r";
  if (amode & 2) perms += "w";
  if (amode & 1) perms += "x";
  if (perms && FS.nodePermissions(node, perms)) {
   return -ERRNO_CODES.EACCES;
  }
  return 0;
 }),
 doDup: (function(path, flags, suggestFD) {
  var suggest = FS.getStream(suggestFD);
  if (suggest) FS.close(suggest);
  return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
 }),
 doReadv: (function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.read(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
   if (curr < len) break;
  }
  return ret;
 }),
 doWritev: (function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.write(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
  }
  return ret;
 }),
 varargs: 0,
 get: (function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 }),
 getStr: (function() {
  var ret = Pointer_stringify(SYSCALLS.get());
  return ret;
 }),
 getStreamFromFD: (function() {
  var stream = FS.getStream(SYSCALLS.get());
  if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return stream;
 }),
 getSocketFromFD: (function() {
  var socket = SOCKFS.getSocket(SYSCALLS.get());
  if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return socket;
 }),
 getSocketAddress: (function(allowNull) {
  var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
  if (allowNull && addrp === 0) return null;
  var info = __read_sockaddr(addrp, addrlen);
  if (info.errno) throw new FS.ErrnoError(info.errno);
  info.addr = DNS.lookup_addr(info.addr) || info.addr;
  return info;
 }),
 get64: (function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  if (low >= 0) assert(high === 0); else assert(high === -1);
  return low;
 }),
 getZero: (function() {
  assert(SYSCALLS.get() === 0);
 })
};
function ___syscall20(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  return PROCINFO.pid;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
Module["_memset"] = _memset;
var _BDtoILow = true;
function ___wait() {
 Module["printErr"]("missing function: __wait");
 abort(-1);
}
Module["_bitshift64Shl"] = _bitshift64Shl;
function _abort() {
 Module["abort"]();
}
function ___syscall195(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
  return SYSCALLS.doStat(FS.stat, path, buf);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall196(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
  return SYSCALLS.doStat(FS.lstat, path, buf);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall3(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.read(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
var _emscripten_prep_setjmp = true;
function ___lock() {}
function ___unlock() {}
Module["_i64Add"] = _i64Add;
var _emscripten_cleanup_setjmp = true;
var _environ = allocate(1, "i32*", ALLOC_STATIC);
var ___environ = _environ;
function ___buildEnvironment(env) {
 var MAX_ENV_VALUES = 64;
 var TOTAL_ENV_SIZE = 1024;
 var poolPtr;
 var envPtr;
 if (!___buildEnvironment.called) {
  ___buildEnvironment.called = true;
  ENV["USER"] = ENV["LOGNAME"] = "web_user";
  ENV["PATH"] = "/";
  ENV["PWD"] = "/";
  ENV["HOME"] = "/home/web_user";
  ENV["LANG"] = "C";
  ENV["_"] = Module["thisProgram"];
  poolPtr = allocate(TOTAL_ENV_SIZE, "i8", ALLOC_STATIC);
  envPtr = allocate(MAX_ENV_VALUES * 4, "i8*", ALLOC_STATIC);
  HEAP32[envPtr >> 2] = poolPtr;
  HEAP32[_environ >> 2] = envPtr;
 } else {
  envPtr = HEAP32[_environ >> 2];
  poolPtr = HEAP32[envPtr >> 2];
 }
 var strings = [];
 var totalSize = 0;
 for (var key in env) {
  if (typeof env[key] === "string") {
   var line = key + "=" + env[key];
   strings.push(line);
   totalSize += line.length;
  }
 }
 if (totalSize > TOTAL_ENV_SIZE) {
  throw new Error("Environment size exceeded TOTAL_ENV_SIZE!");
 }
 var ptrSize = 4;
 for (var i = 0; i < strings.length; i++) {
  var line = strings[i];
  writeAsciiToMemory(line, poolPtr);
  HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
  poolPtr += line.length + 1;
 }
 HEAP32[envPtr + strings.length * ptrSize >> 2] = 0;
}
var ENV = {};
function _putenv(string) {
 if (string === 0) {
  ___setErrNo(ERRNO_CODES.EINVAL);
  return -1;
 }
 string = Pointer_stringify(string);
 var splitPoint = string.indexOf("=");
 if (string === "" || string.indexOf("=") === -1) {
  ___setErrNo(ERRNO_CODES.EINVAL);
  return -1;
 }
 var name = string.slice(0, splitPoint);
 var value = string.slice(splitPoint + 1);
 if (!(name in ENV) || ENV[name] !== value) {
  ENV[name] = value;
  ___buildEnvironment(ENV);
 }
 return 0;
}
var _emscripten_check_longjmp = true;
function _realloc() {
 throw "bad";
}
Module["_realloc"] = _realloc;
Module["_saveSetjmp"] = _saveSetjmp;
function ___syscall140(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
  var offset = offset_low;
  assert(offset_high === 0);
  FS.llseek(stream, offset, whence);
  HEAP32[result >> 2] = stream.position;
  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function _emscripten_set_main_loop_timing(mode, value) {
 Browser.mainLoop.timingMode = mode;
 Browser.mainLoop.timingValue = value;
 if (!Browser.mainLoop.func) {
  return 1;
 }
 if (mode == 0) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
   setTimeout(Browser.mainLoop.runner, value);
  };
  Browser.mainLoop.method = "timeout";
 } else if (mode == 1) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
   Browser.requestAnimationFrame(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "rAF";
 } else if (mode == 2) {
  if (!window["setImmediate"]) {
   var setImmediates = [];
   var emscriptenMainLoopMessageId = "__emcc";
   function Browser_setImmediate_messageHandler(event) {
    if (event.source === window && event.data === emscriptenMainLoopMessageId) {
     event.stopPropagation();
     setImmediates.shift()();
    }
   }
   window.addEventListener("message", Browser_setImmediate_messageHandler, true);
   window["setImmediate"] = function Browser_emulated_setImmediate(func) {
    setImmediates.push(func);
    window.postMessage(emscriptenMainLoopMessageId, "*");
   };
  }
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
   window["setImmediate"](Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "immediate";
 }
 return 0;
}
function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
 Module["noExitRuntime"] = true;
 assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
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
    var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
    if (blocker.counted) {
     Browser.mainLoop.remainingBlockers = next;
    } else {
     next = next + .5;
     Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
    }
   }
   console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
   Browser.mainLoop.updateStatus();
   setTimeout(Browser.mainLoop.runner, 0);
   return;
  }
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
  if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
   Browser.mainLoop.scheduler();
   return;
  }
  if (Browser.mainLoop.method === "timeout" && Module.ctx) {
   Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
   Browser.mainLoop.method = "";
  }
  Browser.mainLoop.runIter((function() {
   if (typeof arg !== "undefined") {
    Runtime.dynCall("vi", func, [ arg ]);
   } else {
    Runtime.dynCall("v", func);
   }
  }));
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  Browser.mainLoop.scheduler();
 };
 if (!noSetTiming) {
  if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps); else _emscripten_set_main_loop_timing(1, 1);
  Browser.mainLoop.scheduler();
 }
 if (simulateInfiniteLoop) {
  throw "SimulateInfiniteLoop";
 }
}
var Browser = {
 mainLoop: {
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  pause: (function() {
   Browser.mainLoop.scheduler = null;
   Browser.mainLoop.currentlyRunningMainloop++;
  }),
  resume: (function() {
   Browser.mainLoop.currentlyRunningMainloop++;
   var timingMode = Browser.mainLoop.timingMode;
   var timingValue = Browser.mainLoop.timingValue;
   var func = Browser.mainLoop.func;
   Browser.mainLoop.func = null;
   _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
   _emscripten_set_main_loop_timing(timingMode, timingValue);
   Browser.mainLoop.scheduler();
  }),
  updateStatus: (function() {
   if (Module["setStatus"]) {
    var message = Module["statusMessage"] || "Please wait...";
    var remaining = Browser.mainLoop.remainingBlockers;
    var expected = Browser.mainLoop.expectedBlockers;
    if (remaining) {
     if (remaining < expected) {
      Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
     } else {
      Module["setStatus"](message);
     }
    } else {
     Module["setStatus"]("");
    }
   }
  }),
  runIter: (function(func) {
   if (ABORT) return;
   if (Module["preMainLoop"]) {
    var preRet = Module["preMainLoop"]();
    if (preRet === false) {
     return;
    }
   }
   try {
    func();
   } catch (e) {
    if (e instanceof ExitStatus) {
     return;
    } else {
     if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [ e, e.stack ]);
     throw e;
    }
   }
   if (Module["postMainLoop"]) Module["postMainLoop"]();
  })
 },
 isFullScreen: false,
 pointerLock: false,
 moduleContextCreatedCallbacks: [],
 workers: [],
 init: (function() {
  if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
  if (Browser.initted) return;
  Browser.initted = true;
  try {
   new Blob;
   Browser.hasBlobConstructor = true;
  } catch (e) {
   Browser.hasBlobConstructor = false;
   console.log("warning: no blob constructor, cannot create blobs with mimetypes");
  }
  Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
  Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
  if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
   console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
   Module.noImageDecoding = true;
  }
  var imagePlugin = {};
  imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
   return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
  };
  imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
   var b = null;
   if (Browser.hasBlobConstructor) {
    try {
     b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
     if (b.size !== byteArray.length) {
      b = new Blob([ (new Uint8Array(byteArray)).buffer ], {
       type: Browser.getMimetype(name)
      });
     }
    } catch (e) {
     Runtime.warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
    }
   }
   if (!b) {
    var bb = new Browser.BlobBuilder;
    bb.append((new Uint8Array(byteArray)).buffer);
    b = bb.getBlob();
   }
   var url = Browser.URLObject.createObjectURL(b);
   var img = new Image;
   img.onload = function img_onload() {
    assert(img.complete, "Image " + name + " could not be decoded");
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    Module["preloadedImages"][name] = canvas;
    Browser.URLObject.revokeObjectURL(url);
    if (onload) onload(byteArray);
   };
   img.onerror = function img_onerror(event) {
    console.log("Image " + url + " could not be decoded");
    if (onerror) onerror();
   };
   img.src = url;
  };
  Module["preloadPlugins"].push(imagePlugin);
  var audioPlugin = {};
  audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
   return !Module.noAudioDecoding && name.substr(-4) in {
    ".ogg": 1,
    ".wav": 1,
    ".mp3": 1
   };
  };
  audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
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
    Module["preloadedAudios"][name] = new Audio;
    if (onerror) onerror();
   }
   if (Browser.hasBlobConstructor) {
    try {
     var b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
    } catch (e) {
     return fail();
    }
    var url = Browser.URLObject.createObjectURL(b);
    var audio = new Audio;
    audio.addEventListener("canplaythrough", (function() {
     finish(audio);
    }), false);
    audio.onerror = function audio_onerror(event) {
     if (done) return;
     console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
     function encode64(data) {
      var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var PAD = "=";
      var ret = "";
      var leftchar = 0;
      var leftbits = 0;
      for (var i = 0; i < data.length; i++) {
       leftchar = leftchar << 8 | data[i];
       leftbits += 8;
       while (leftbits >= 6) {
        var curr = leftchar >> leftbits - 6 & 63;
        leftbits -= 6;
        ret += BASE[curr];
       }
      }
      if (leftbits == 2) {
       ret += BASE[(leftchar & 3) << 4];
       ret += PAD + PAD;
      } else if (leftbits == 4) {
       ret += BASE[(leftchar & 15) << 2];
       ret += PAD;
      }
      return ret;
     }
     audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
     finish(audio);
    };
    audio.src = url;
    Browser.safeSetTimeout((function() {
     finish(audio);
    }), 1e4);
   } else {
    return fail();
   }
  };
  Module["preloadPlugins"].push(audioPlugin);
  var canvas = Module["canvas"];
  function pointerLockChange() {
   Browser.pointerLock = document["pointerLockElement"] === canvas || document["mozPointerLockElement"] === canvas || document["webkitPointerLockElement"] === canvas || document["msPointerLockElement"] === canvas;
  }
  if (canvas) {
   canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || (function() {});
   canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || (function() {});
   canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
   document.addEventListener("pointerlockchange", pointerLockChange, false);
   document.addEventListener("mozpointerlockchange", pointerLockChange, false);
   document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
   document.addEventListener("mspointerlockchange", pointerLockChange, false);
   if (Module["elementPointerLock"]) {
    canvas.addEventListener("click", (function(ev) {
     if (!Browser.pointerLock && canvas.requestPointerLock) {
      canvas.requestPointerLock();
      ev.preventDefault();
     }
    }), false);
   }
  }
 }),
 createContext: (function(canvas, useWebGL, setInModule, webGLContextAttributes) {
  if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
  var ctx;
  var contextHandle;
  if (useWebGL) {
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
   canvas.style.backgroundColor = "black";
  } else {
   ctx = canvas.getContext("2d");
  }
  if (!ctx) return null;
  if (setInModule) {
   if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
   Module.ctx = ctx;
   if (useWebGL) GL.makeContextCurrent(contextHandle);
   Module.useWebGL = useWebGL;
   Browser.moduleContextCreatedCallbacks.forEach((function(callback) {
    callback();
   }));
   Browser.init();
  }
  return ctx;
 }),
 destroyContext: (function(canvas, useWebGL, setInModule) {}),
 fullScreenHandlersInstalled: false,
 lockPointer: undefined,
 resizeCanvas: undefined,
 requestFullScreen: (function(lockPointer, resizeCanvas, vrDevice) {
  Browser.lockPointer = lockPointer;
  Browser.resizeCanvas = resizeCanvas;
  Browser.vrDevice = vrDevice;
  if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
  if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
  if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
  var canvas = Module["canvas"];
  function fullScreenChange() {
   Browser.isFullScreen = false;
   var canvasContainer = canvas.parentNode;
   if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
    canvas.cancelFullScreen = document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["webkitCancelFullScreen"] || document["msExitFullscreen"] || document["exitFullscreen"] || (function() {});
    canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
    if (Browser.lockPointer) canvas.requestPointerLock();
    Browser.isFullScreen = true;
    if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
   } else {
    canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
    canvasContainer.parentNode.removeChild(canvasContainer);
    if (Browser.resizeCanvas) Browser.setWindowedCanvasSize();
   }
   if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullScreen);
   Browser.updateCanvasDimensions(canvas);
  }
  if (!Browser.fullScreenHandlersInstalled) {
   Browser.fullScreenHandlersInstalled = true;
   document.addEventListener("fullscreenchange", fullScreenChange, false);
   document.addEventListener("mozfullscreenchange", fullScreenChange, false);
   document.addEventListener("webkitfullscreenchange", fullScreenChange, false);
   document.addEventListener("MSFullscreenChange", fullScreenChange, false);
  }
  var canvasContainer = document.createElement("div");
  canvas.parentNode.insertBefore(canvasContainer, canvas);
  canvasContainer.appendChild(canvas);
  canvasContainer.requestFullScreen = canvasContainer["requestFullScreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullScreen"] ? (function() {
   canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  }) : null);
  if (vrDevice) {
   canvasContainer.requestFullScreen({
    vrDisplay: vrDevice
   });
  } else {
   canvasContainer.requestFullScreen();
  }
 }),
 nextRAF: 0,
 fakeRequestAnimationFrame: (function(func) {
  var now = Date.now();
  if (Browser.nextRAF === 0) {
   Browser.nextRAF = now + 1e3 / 60;
  } else {
   while (now + 2 >= Browser.nextRAF) {
    Browser.nextRAF += 1e3 / 60;
   }
  }
  var delay = Math.max(Browser.nextRAF - now, 0);
  setTimeout(func, delay);
 }),
 requestAnimationFrame: function requestAnimationFrame(func) {
  if (typeof window === "undefined") {
   Browser.fakeRequestAnimationFrame(func);
  } else {
   if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
   }
   window.requestAnimationFrame(func);
  }
 },
 safeCallback: (function(func) {
  return (function() {
   if (!ABORT) return func.apply(null, arguments);
  });
 }),
 allowAsyncCallbacks: true,
 queuedAsyncCallbacks: [],
 pauseAsyncCallbacks: (function() {
  Browser.allowAsyncCallbacks = false;
 }),
 resumeAsyncCallbacks: (function() {
  Browser.allowAsyncCallbacks = true;
  if (Browser.queuedAsyncCallbacks.length > 0) {
   var callbacks = Browser.queuedAsyncCallbacks;
   Browser.queuedAsyncCallbacks = [];
   callbacks.forEach((function(func) {
    func();
   }));
  }
 }),
 safeRequestAnimationFrame: (function(func) {
  return Browser.requestAnimationFrame((function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  }));
 }),
 safeSetTimeout: (function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setTimeout((function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  }), timeout);
 }),
 safeSetInterval: (function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setInterval((function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   }
  }), timeout);
 }),
 getMimetype: (function(name) {
  return {
   "jpg": "image/jpeg",
   "jpeg": "image/jpeg",
   "png": "image/png",
   "bmp": "image/bmp",
   "ogg": "audio/ogg",
   "wav": "audio/wav",
   "mp3": "audio/mpeg"
  }[name.substr(name.lastIndexOf(".") + 1)];
 }),
 getUserMedia: (function(func) {
  if (!window.getUserMedia) {
   window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
  }
  window.getUserMedia(func);
 }),
 getMovementX: (function(event) {
  return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
 }),
 getMovementY: (function(event) {
  return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
 }),
 getMouseWheelDelta: (function(event) {
  var delta = 0;
  switch (event.type) {
  case "DOMMouseScroll":
   delta = event.detail;
   break;
  case "mousewheel":
   delta = event.wheelDelta;
   break;
  case "wheel":
   delta = event["deltaY"];
   break;
  default:
   throw "unrecognized mouse wheel event: " + event.type;
  }
  return delta;
 }),
 mouseX: 0,
 mouseY: 0,
 mouseMovementX: 0,
 mouseMovementY: 0,
 touches: {},
 lastTouches: {},
 calculateMouseEvent: (function(event) {
  if (Browser.pointerLock) {
   if (event.type != "mousemove" && "mozMovementX" in event) {
    Browser.mouseMovementX = Browser.mouseMovementY = 0;
   } else {
    Browser.mouseMovementX = Browser.getMovementX(event);
    Browser.mouseMovementY = Browser.getMovementY(event);
   }
   if (typeof SDL != "undefined") {
    Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
    Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
   } else {
    Browser.mouseX += Browser.mouseMovementX;
    Browser.mouseY += Browser.mouseMovementY;
   }
  } else {
   var rect = Module["canvas"].getBoundingClientRect();
   var cw = Module["canvas"].width;
   var ch = Module["canvas"].height;
   var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
   var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
   if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
    var touch = event.touch;
    if (touch === undefined) {
     return;
    }
    var adjustedX = touch.pageX - (scrollX + rect.left);
    var adjustedY = touch.pageY - (scrollY + rect.top);
    adjustedX = adjustedX * (cw / rect.width);
    adjustedY = adjustedY * (ch / rect.height);
    var coords = {
     x: adjustedX,
     y: adjustedY
    };
    if (event.type === "touchstart") {
     Browser.lastTouches[touch.identifier] = coords;
     Browser.touches[touch.identifier] = coords;
    } else if (event.type === "touchend" || event.type === "touchmove") {
     var last = Browser.touches[touch.identifier];
     if (!last) last = coords;
     Browser.lastTouches[touch.identifier] = last;
     Browser.touches[touch.identifier] = coords;
    }
    return;
   }
   var x = event.pageX - (scrollX + rect.left);
   var y = event.pageY - (scrollY + rect.top);
   x = x * (cw / rect.width);
   y = y * (ch / rect.height);
   Browser.mouseMovementX = x - Browser.mouseX;
   Browser.mouseMovementY = y - Browser.mouseY;
   Browser.mouseX = x;
   Browser.mouseY = y;
  }
 }),
 xhrLoad: (function(url, onload, onerror) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
   } else {
    onerror();
   }
  };
  xhr.onerror = onerror;
  xhr.send(null);
 }),
 asyncLoad: (function(url, onload, onerror, noRunDep) {
  Browser.xhrLoad(url, (function(arrayBuffer) {
   assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
   onload(new Uint8Array(arrayBuffer));
   if (!noRunDep) removeRunDependency("al " + url);
  }), (function(event) {
   if (onerror) {
    onerror();
   } else {
    throw 'Loading data file "' + url + '" failed.';
   }
  }));
  if (!noRunDep) addRunDependency("al " + url);
 }),
 resizeListeners: [],
 updateResizeListeners: (function() {
  var canvas = Module["canvas"];
  Browser.resizeListeners.forEach((function(listener) {
   listener(canvas.width, canvas.height);
  }));
 }),
 setCanvasSize: (function(width, height, noUpdates) {
  var canvas = Module["canvas"];
  Browser.updateCanvasDimensions(canvas, width, height);
  if (!noUpdates) Browser.updateResizeListeners();
 }),
 windowedWidth: 0,
 windowedHeight: 0,
 setFullScreenCanvasSize: (function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
   flags = flags | 8388608;
   HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
  }
  Browser.updateResizeListeners();
 }),
 setWindowedCanvasSize: (function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2];
   flags = flags & ~8388608;
   HEAP32[SDL.screen + Runtime.QUANTUM_SIZE * 0 >> 2] = flags;
  }
  Browser.updateResizeListeners();
 }),
 updateCanvasDimensions: (function(canvas, wNative, hNative) {
  if (wNative && hNative) {
   canvas.widthNative = wNative;
   canvas.heightNative = hNative;
  } else {
   wNative = canvas.widthNative;
   hNative = canvas.heightNative;
  }
  var w = wNative;
  var h = hNative;
  if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
   if (w / h < Module["forcedAspectRatio"]) {
    w = Math.round(h * Module["forcedAspectRatio"]);
   } else {
    h = Math.round(w / Module["forcedAspectRatio"]);
   }
  }
  if ((document["webkitFullScreenElement"] || document["webkitFullscreenElement"] || document["mozFullScreenElement"] || document["mozFullscreenElement"] || document["fullScreenElement"] || document["fullscreenElement"] || document["msFullScreenElement"] || document["msFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
   var factor = Math.min(screen.width / w, screen.height / h);
   w = Math.round(w * factor);
   h = Math.round(h * factor);
  }
  if (Browser.resizeCanvas) {
   if (canvas.width != w) canvas.width = w;
   if (canvas.height != h) canvas.height = h;
   if (typeof canvas.style != "undefined") {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
   }
  } else {
   if (canvas.width != wNative) canvas.width = wNative;
   if (canvas.height != hNative) canvas.height = hNative;
   if (typeof canvas.style != "undefined") {
    if (w != wNative || h != hNative) {
     canvas.style.setProperty("width", w + "px", "important");
     canvas.style.setProperty("height", h + "px", "important");
    } else {
     canvas.style.removeProperty("width");
     canvas.style.removeProperty("height");
    }
   }
  }
 }),
 wgetRequests: {},
 nextWgetRequestHandle: 0,
 getNextWgetRequestHandle: (function() {
  var handle = Browser.nextWgetRequestHandle;
  Browser.nextWgetRequestHandle++;
  return handle;
 })
};
var _emscripten_get_longjmp_result = true;
function __exit(status) {
 Module["exit"](status);
}
function _exit(status) {
 __exit(status);
}
function ___syscall6(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  FS.close(stream);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall54(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
  switch (op) {
  case 21505:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }
  case 21506:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }
  case 21519:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    var argp = SYSCALLS.get();
    HEAP32[argp >> 2] = 0;
    return 0;
   }
  case 21520:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return -ERRNO_CODES.EINVAL;
   }
  case 21531:
   {
    var argp = SYSCALLS.get();
    return FS.ioctl(stream, op, argp);
   }
  default:
   abort("bad ioctl syscall " + op);
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function _fork() {
 ___setErrNo(ERRNO_CODES.EAGAIN);
 return -1;
}
function _sysconf(name) {
 switch (name) {
 case 30:
  return PAGE_SIZE;
 case 85:
  return totalMemory / PAGE_SIZE;
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
 case 0:
  return 2097152;
 case 3:
  return 65536;
 case 28:
  return 32768;
 case 44:
  return 32767;
 case 75:
  return 16384;
 case 39:
  return 1e3;
 case 89:
  return 700;
 case 71:
  return 256;
 case 40:
  return 255;
 case 2:
  return 100;
 case 180:
  return 64;
 case 25:
  return 20;
 case 5:
  return 16;
 case 6:
  return 6;
 case 73:
  return 4;
 case 84:
  {
   if (typeof navigator === "object") return navigator["hardwareConcurrency"] || 1;
   return 1;
  }
 }
 ___setErrNo(ERRNO_CODES.EINVAL);
 return -1;
}
Module["_bitshift64Lshr"] = _bitshift64Lshr;
function _execl() {
 ___setErrNo(ERRNO_CODES.ENOEXEC);
 return -1;
}
function _execvp() {
 return _execl.apply(null, arguments);
}
Module["_testSetjmp"] = _testSetjmp;
function _longjmp(env, value) {
 asm["setThrew"](env, value || 1);
 throw "longjmp";
}
function ___syscall220(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), dirp = SYSCALLS.get(), count = SYSCALLS.get();
  if (!stream.getdents) {
   stream.getdents = FS.readdir(stream.path);
  }
  var pos = 0;
  while (stream.getdents.length > 0 && pos + 268 < count) {
   var id;
   var type;
   var name = stream.getdents.pop();
   assert(name.length < 256);
   if (name[0] === ".") {
    id = 1;
    type = 4;
   } else {
    var child = FS.lookupNode(stream.node, name);
    id = child.id;
    type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8;
   }
   HEAP32[dirp + pos >> 2] = id;
   HEAP32[dirp + pos + 4 >> 2] = stream.position;
   HEAP16[dirp + pos + 8 >> 1] = 268;
   HEAP8[dirp + pos + 10 >> 0] = type;
   for (var i = 0; i < name.length; i++) {
    HEAP8[dirp + pos + (11 + i) >> 0] = name.charCodeAt(i);
   }
   HEAP8[dirp + pos + (11 + i) >> 0] = 0;
   pos += 268;
  }
  return pos;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall33(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), amode = SYSCALLS.get();
  return SYSCALLS.doAccess(path, amode);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
var _BDtoIHigh = true;
function _pthread_cleanup_push(routine, arg) {
 __ATEXIT__.push((function() {
  Runtime.dynCall("vi", routine, [ arg ]);
 }));
 _pthread_cleanup_push.level = __ATEXIT__.length;
}
function _emscripten_longjmp(env, value) {
 _longjmp(env, value);
}
function _getenv(name) {
 if (name === 0) return 0;
 name = Pointer_stringify(name);
 if (!ENV.hasOwnProperty(name)) return 0;
 if (_getenv.ret) _free(_getenv.ret);
 _getenv.ret = allocate(intArrayFromString(ENV[name]), "i8", ALLOC_NORMAL);
 return _getenv.ret;
}
function _pthread_cleanup_pop() {
 assert(_pthread_cleanup_push.level == __ATEXIT__.length, "cannot pop if something else added meanwhile!");
 __ATEXIT__.pop();
 _pthread_cleanup_push.level = __ATEXIT__.length;
}
function _getpwnam() {
 throw "getpwnam: TODO";
}
function __Exit() {
 Module["printErr"]("missing function: _Exit");
 abort(-1);
}
function ___syscall5(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get();
  var stream = FS.open(pathname, flags, mode);
  return stream.fd;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall4(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.write(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function _wait(stat_loc) {
 ___setErrNo(ERRNO_CODES.ECHILD);
 return -1;
}
var _emscripten_setjmp = true;
var _emscripten_postinvoke = true;
function _sbrk(bytes) {
 var self = _sbrk;
 if (!self.called) {
  DYNAMICTOP = alignMemoryPage(DYNAMICTOP);
  self.called = true;
  assert(Runtime.dynamicAlloc);
  self.alloc = Runtime.dynamicAlloc;
  Runtime.dynamicAlloc = (function() {
   abort("cannot dynamically allocate, sbrk now has control");
  });
 }
 var ret = DYNAMICTOP;
 if (bytes != 0) {
  var success = self.alloc(bytes);
  if (!success) return -1 >>> 0;
 }
 return ret;
}
function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
 return dest;
}
Module["_memcpy"] = _memcpy;
Module["_memmove"] = _memmove;
function ___syscall51(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  return -ERRNO_CODES.ENOSYS;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall42() {
 return ___syscall51.apply(null, arguments);
}
var _emscripten_preinvoke = true;
var _BItoD = true;
function ___syscall85(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var path = SYSCALLS.getStr(), buf = SYSCALLS.get(), bufsize = SYSCALLS.get();
  return SYSCALLS.doReadlink(path, buf, bufsize);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function _time(ptr) {
 var ret = Date.now() / 1e3 | 0;
 if (ptr) {
  HEAP32[ptr >> 2] = ret;
 }
 return ret;
}
function _pthread_self() {
 return 0;
}
function ___syscall183(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var buf = SYSCALLS.get(), size = SYSCALLS.get();
  if (size === 0) return -ERRNO_CODES.EINVAL;
  var cwd = FS.cwd();
  if (size < cwd.length + 1) return -ERRNO_CODES.ERANGE;
  writeAsciiToMemory(cwd, buf);
  return buf;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall41(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var old = SYSCALLS.getStreamFromFD();
  return FS.open(old.path, old.flags, 0).fd;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doWritev(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall221(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
  switch (cmd) {
  case 0:
   {
    var arg = SYSCALLS.get();
    if (arg < 0) {
     return -ERRNO_CODES.EINVAL;
    }
    var newStream;
    newStream = FS.open(stream.path, stream.flags, 0, arg);
    return newStream.fd;
   }
  case 1:
  case 2:
   return 0;
  case 3:
   return stream.flags;
  case 4:
   {
    var arg = SYSCALLS.get();
    stream.flags |= arg;
    return 0;
   }
  case 12:
  case 12:
   {
    var arg = SYSCALLS.get();
    var offset = 0;
    HEAP16[arg + offset >> 1] = 2;
    return 0;
   }
  case 13:
  case 14:
  case 13:
  case 14:
   return 0;
  case 16:
  case 8:
   return -ERRNO_CODES.EINVAL;
  case 9:
   ___setErrNo(ERRNO_CODES.EINVAL);
   return -1;
  default:
   {
    return -ERRNO_CODES.EINVAL;
   }
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall145(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doReadv(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
FS.staticInit();
__ATINIT__.unshift((function() {
 if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
}));
__ATMAIN__.push((function() {
 FS.ignorePermissions = false;
}));
__ATEXIT__.push((function() {
 FS.quit();
}));
Module["FS_createFolder"] = FS.createFolder;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createLink"] = FS.createLink;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
__ATINIT__.unshift((function() {
 TTY.init();
}));
__ATEXIT__.push((function() {
 TTY.shutdown();
}));
if (ENVIRONMENT_IS_NODE) {
 var fs = require("fs");
 var NODEJS_PATH = require("path");
 NODEFS.staticInit();
}
___buildEnvironment(ENV);
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
 Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
};
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
 Browser.requestAnimationFrame(func);
};
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
 Browser.setCanvasSize(width, height, noUpdates);
};
Module["pauseMainLoop"] = function Module_pauseMainLoop() {
 Browser.mainLoop.pause();
};
Module["resumeMainLoop"] = function Module_resumeMainLoop() {
 Browser.mainLoop.resume();
};
Module["getUserMedia"] = function Module_getUserMedia() {
 Browser.getUserMedia();
};
Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
 return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
};
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true;
STACK_MAX = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");
var cttz_i8 = allocate([ 8, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 7, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 6, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 5, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0, 4, 0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 0, 1, 0 ], "i8", ALLOC_DYNAMIC);
function invoke_iiii(index, a1, a2, a3) {
 try {
  return Module["dynCall_iiii"](index, a1, a2, a3);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
function invoke_i(index) {
 try {
  return Module["dynCall_i"](index);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
function invoke_vi(index, a1) {
 try {
  Module["dynCall_vi"](index, a1);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
function invoke_ii(index, a1) {
 try {
  return Module["dynCall_ii"](index, a1);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
function invoke_v(index) {
 try {
  Module["dynCall_v"](index);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
function invoke_iii(index, a1, a2) {
 try {
  return Module["dynCall_iii"](index, a1, a2);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  asm["setThrew"](1, 0);
 }
}
Module.asmGlobalArg = {
 "Math": Math,
 "Int8Array": Int8Array,
 "Int16Array": Int16Array,
 "Int32Array": Int32Array,
 "Uint8Array": Uint8Array,
 "Uint16Array": Uint16Array,
 "Uint32Array": Uint32Array,
 "Float32Array": Float32Array,
 "Float64Array": Float64Array,
 "NaN": NaN,
 "Infinity": Infinity
};
Module.asmLibraryArg = {
 "abort": abort,
 "assert": assert,
 "invoke_iiii": invoke_iiii,
 "invoke_i": invoke_i,
 "invoke_vi": invoke_vi,
 "invoke_ii": invoke_ii,
 "invoke_v": invoke_v,
 "invoke_iii": invoke_iii,
 "_pthread_cleanup_pop": _pthread_cleanup_pop,
 "___syscall220": ___syscall220,
 "_putenv": _putenv,
 "___syscall85": ___syscall85,
 "_pthread_cleanup_push": _pthread_cleanup_push,
 "_abort": _abort,
 "_execvp": _execvp,
 "___syscall42": ___syscall42,
 "___setErrNo": ___setErrNo,
 "_fork": _fork,
 "___syscall20": ___syscall20,
 "___syscall4": ___syscall4,
 "__Exit": __Exit,
 "___buildEnvironment": ___buildEnvironment,
 "_longjmp": _longjmp,
 "___wait": ___wait,
 "___assert_fail": ___assert_fail,
 "_wait": _wait,
 "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
 "_sbrk": _sbrk,
 "___syscall196": ___syscall196,
 "___syscall195": ___syscall195,
 "_sysconf": _sysconf,
 "_execl": _execl,
 "_emscripten_memcpy_big": _emscripten_memcpy_big,
 "___syscall221": ___syscall221,
 "_pthread_self": _pthread_self,
 "_getenv": _getenv,
 "___syscall51": ___syscall51,
 "___syscall33": ___syscall33,
 "___syscall54": ___syscall54,
 "___unlock": ___unlock,
 "_emscripten_set_main_loop": _emscripten_set_main_loop,
 "_getpwnam": _getpwnam,
 "___syscall3": ___syscall3,
 "___lock": ___lock,
 "___syscall6": ___syscall6,
 "___syscall5": ___syscall5,
 "___syscall183": ___syscall183,
 "___syscall41": ___syscall41,
 "_time": _time,
 "_emscripten_longjmp": _emscripten_longjmp,
 "___syscall140": ___syscall140,
 "_exit": _exit,
 "___syscall145": ___syscall145,
 "___syscall146": ___syscall146,
 "STACKTOP": STACKTOP,
 "STACK_MAX": STACK_MAX,
 "tempDoublePtr": tempDoublePtr,
 "ABORT": ABORT,
 "cttz_i8": cttz_i8
};
// EMSCRIPTEN_START_ASM

var asm = (function(global,env,buffer) {

 "use asm";
 var a = new global.Int8Array(buffer);
 var b = new global.Int16Array(buffer);
 var c = new global.Int32Array(buffer);
 var d = new global.Uint8Array(buffer);
 var e = new global.Uint16Array(buffer);
 var f = new global.Uint32Array(buffer);
 var g = new global.Float32Array(buffer);
 var h = new global.Float64Array(buffer);
 var i = env.STACKTOP | 0;
 var j = env.STACK_MAX | 0;
 var k = env.tempDoublePtr | 0;
 var l = env.ABORT | 0;
 var m = env.cttz_i8 | 0;
 var n = 0;
 var o = 0;
 var p = 0;
 var q = 0;
 var r = global.NaN, s = global.Infinity;
 var t = 0, u = 0, v = 0, w = 0, x = 0.0, y = 0, z = 0, A = 0, B = 0.0;
 var C = 0;
 var D = 0;
 var E = 0;
 var F = 0;
 var G = 0;
 var H = 0;
 var I = 0;
 var J = 0;
 var K = 0;
 var L = 0;
 var M = global.Math.floor;
 var N = global.Math.abs;
 var O = global.Math.sqrt;
 var P = global.Math.pow;
 var Q = global.Math.cos;
 var R = global.Math.sin;
 var S = global.Math.tan;
 var T = global.Math.acos;
 var U = global.Math.asin;
 var V = global.Math.atan;
 var W = global.Math.atan2;
 var X = global.Math.exp;
 var Y = global.Math.log;
 var Z = global.Math.ceil;
 var _ = global.Math.imul;
 var $ = global.Math.min;
 var aa = global.Math.clz32;
 var ba = env.abort;
 var ca = env.assert;
 var da = env.invoke_iiii;
 var ea = env.invoke_i;
 var fa = env.invoke_vi;
 var ga = env.invoke_ii;
 var ha = env.invoke_v;
 var ia = env.invoke_iii;
 var ja = env._pthread_cleanup_pop;
 var ka = env.___syscall220;
 var la = env._putenv;
 var ma = env.___syscall85;
 var na = env._pthread_cleanup_push;
 var oa = env._abort;
 var pa = env._execvp;
 var qa = env.___syscall42;
 var ra = env.___setErrNo;
 var sa = env._fork;
 var ta = env.___syscall20;
 var ua = env.___syscall4;
 var va = env.__Exit;
 var wa = env.___buildEnvironment;
 var xa = env._longjmp;
 var ya = env.___wait;
 var za = env.___assert_fail;
 var Aa = env._wait;
 var Ba = env._emscripten_set_main_loop_timing;
 var Ca = env._sbrk;
 var Da = env.___syscall196;
 var Ea = env.___syscall195;
 var Fa = env._sysconf;
 var Ga = env._execl;
 var Ha = env._emscripten_memcpy_big;
 var Ia = env.___syscall221;
 var Ja = env._pthread_self;
 var Ka = env._getenv;
 var La = env.___syscall51;
 var Ma = env.___syscall33;
 var Na = env.___syscall54;
 var Oa = env.___unlock;
 var Pa = env._emscripten_set_main_loop;
 var Qa = env._getpwnam;
 var Ra = env.___syscall3;
 var Sa = env.___lock;
 var Ta = env.___syscall6;
 var Ua = env.___syscall5;
 var Va = env.___syscall183;
 var Wa = env.___syscall41;
 var Xa = env._time;
 var Ya = env._emscripten_longjmp;
 var Za = env.___syscall140;
 var _a = env._exit;
 var $a = env.___syscall145;
 var ab = env.___syscall146;
 var bb = 0.0;
 
// EMSCRIPTEN_START_FUNCS

function ff(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0, D = 0, E = 0, F = 0, G = 0, H = 0, I = 0, J = 0, K = 0, L = 0, M = 0, N = 0, O = 0, P = 0, Q = 0, R = 0, S = 0, T = 0, U = 0, V = 0, W = 0, X = 0, Y = 0, Z = 0, _ = 0, $ = 0, aa = 0, ba = 0, ca = 0, da = 0, ea = 0, fa = 0, ga = 0, ha = 0, ia = 0, ja = 0, ka = 0, la = 0, ma = 0, na = 0, oa = 0, pa = 0, qa = 0, ra = 0, sa = 0, ta = 0, ua = 0, va = 0, wa = 0, xa = 0, ya = 0, za = 0, Aa = 0, Ba = 0, Ca = 0, Da = 0, Ea = 0, Fa = 0, Ga = 0, Ha = 0, Ia = 0, Ja = 0, Ka = 0, La = 0, Ma = 0, Na = 0, Oa = 0, Pa = 0, Qa = 0, Ra = 0, Sa = 0, Ta = 0, Ua = 0, Va = 0, Wa = 0, Xa = 0, Ya = 0, Za = 0, $a = 0, ab = 0, bb = 0, cb = 0, db = 0, eb = 0, fb = 0, gb = 0, hb = 0, ib = 0, jb = 0, kb = 0, lb = 0, mb = 0, nb = 0, ob = 0, pb = 0, qb = 0, rb = 0, sb = 0, tb = 0, ub = 0, vb = 0, wb = 0, xb = 0, yb = 0, zb = 0, Ab = 0, Bb = 0, Cb = 0, Db = 0, Eb = 0, Fb = 0, Gb = 0, Hb = 0, Ib = 0, Jb = 0, Kb = 0, Lb = 0, Mb = 0, Nb = 0, Ob = 0, Pb = 0, Qb = 0, Rb = 0, Sb = 0, Tb = 0, Ub = 0, Vb = 0, Wb = 0, Xb = 0, Yb = 0, Zb = 0, _b = 0, $b = 0, ac = 0, bc = 0, cc = 0, dc = 0, ec = 0, fc = 0, gc = 0, hc = 0, ic = 0, jc = 0, kc = 0, lc = 0, mc = 0, nc = 0, oc = 0, pc = 0, qc = 0, rc = 0, sc = 0, tc = 0, uc = 0, vc = 0, wc = 0, xc = 0, yc = 0, zc = 0, Ac = 0, Bc = 0, Cc = 0, Dc = 0, Ec = 0, Fc = 0, Gc = 0, Hc = 0, Ic = 0, Jc = 0, Kc = 0, Lc = 0, Mc = 0, Nc = 0, Oc = 0, Pc = 0, Qc = 0, Rc = 0, Sc = 0, Tc = 0, Uc = 0, Vc = 0, Wc = 0, Xc = 0, Yc = 0;
 Yc = i;
 i = i + 2208 | 0;
 Xc = Yc + 2176 | 0;
 Wc = Yc + 2168 | 0;
 Vc = Yc + 2160 | 0;
 Uc = Yc + 2152 | 0;
 Tc = Yc + 2144 | 0;
 Oc = Yc + 2136 | 0;
 Nc = Yc + 2128 | 0;
 Mc = Yc + 2120 | 0;
 Kc = Yc + 2112 | 0;
 Ic = Yc + 2104 | 0;
 Hc = Yc + 2096 | 0;
 Gc = Yc + 2088 | 0;
 Fc = Yc + 2080 | 0;
 Ec = Yc + 2072 | 0;
 xc = Yc + 2064 | 0;
 wc = Yc + 2056 | 0;
 vc = Yc + 2048 | 0;
 uc = Yc + 2040 | 0;
 tc = Yc + 2032 | 0;
 sc = Yc + 2024 | 0;
 rc = Yc + 2016 | 0;
 qc = Yc + 2008 | 0;
 pc = Yc + 2e3 | 0;
 nc = Yc + 1992 | 0;
 mc = Yc + 1984 | 0;
 lc = Yc + 1968 | 0;
 kc = Yc + 1960 | 0;
 jc = Yc + 1952 | 0;
 ic = Yc + 1936 | 0;
 hc = Yc + 1928 | 0;
 gc = Yc + 1912 | 0;
 fc = Yc + 1896 | 0;
 dc = Yc + 1880 | 0;
 cc = Yc + 1864 | 0;
 bc = Yc + 1848 | 0;
 ac = Yc + 1840 | 0;
 $b = Yc + 1832 | 0;
 _b = Yc + 1824 | 0;
 Zb = Yc + 1816 | 0;
 Yb = Yc + 1808 | 0;
 Wb = Yc + 1776 | 0;
 Vb = Yc + 1768 | 0;
 Ub = Yc + 1760 | 0;
 Tb = Yc + 1752 | 0;
 Sb = Yc + 1744 | 0;
 Rb = Yc + 1736 | 0;
 Qb = Yc + 1728 | 0;
 Pb = Yc + 1712 | 0;
 Ob = Yc + 1704 | 0;
 Nb = Yc + 1696 | 0;
 Mb = Yc + 1688 | 0;
 Lb = Yc + 1680 | 0;
 Kb = Yc + 1664 | 0;
 Ib = Yc + 1656 | 0;
 Hb = Yc + 1648 | 0;
 Gb = Yc + 1632 | 0;
 Fb = Yc + 1624 | 0;
 Eb = Yc + 1608 | 0;
 Db = Yc + 1600 | 0;
 Cb = Yc + 1592 | 0;
 Ab = Yc + 1576 | 0;
 zb = Yc + 1568 | 0;
 yb = Yc + 1552 | 0;
 xb = Yc + 1544 | 0;
 wb = Yc + 1536 | 0;
 vb = Yc + 1528 | 0;
 ub = Yc + 1520 | 0;
 tb = Yc + 1512 | 0;
 sb = Yc + 1504 | 0;
 rb = Yc + 1496 | 0;
 pb = Yc + 1480 | 0;
 ob = Yc + 1472 | 0;
 nb = Yc + 1464 | 0;
 mb = Yc + 1440 | 0;
 lb = Yc + 1432 | 0;
 kb = Yc + 1424 | 0;
 jb = Yc + 1400 | 0;
 ib = Yc + 1392 | 0;
 hb = Yc + 1384 | 0;
 gb = Yc + 1368 | 0;
 fb = Yc + 1360 | 0;
 db = Yc + 1344 | 0;
 cb = Yc + 1320 | 0;
 bb = Yc + 1312 | 0;
 ab = Yc + 1296 | 0;
 $a = Yc + 1288 | 0;
 Za = Yc + 1280 | 0;
 Ya = Yc + 1264 | 0;
 Xa = Yc + 1256 | 0;
 Wa = Yc + 1248 | 0;
 Va = Yc + 1240 | 0;
 Ua = Yc + 1232 | 0;
 Ta = Yc + 1216 | 0;
 Sa = Yc + 1200 | 0;
 Ra = Yc + 1176 | 0;
 Qa = Yc + 1152 | 0;
 Pa = Yc + 1144 | 0;
 Oa = Yc + 1136 | 0;
 Na = Yc + 1120 | 0;
 Ma = Yc + 1112 | 0;
 La = Yc + 1104 | 0;
 Ka = Yc + 1096 | 0;
 Ja = Yc + 1088 | 0;
 Ia = Yc + 1072 | 0;
 Ha = Yc + 1064 | 0;
 Fa = Yc + 1056 | 0;
 Ea = Yc + 1048 | 0;
 Da = Yc + 1040 | 0;
 Ba = Yc + 1024 | 0;
 Aa = Yc + 984 | 0;
 za = Yc + 976 | 0;
 ya = Yc + 968 | 0;
 xa = Yc + 960 | 0;
 wa = Yc + 952 | 0;
 ua = Yc + 936 | 0;
 ta = Yc + 928 | 0;
 sa = Yc + 912 | 0;
 ra = Yc + 904 | 0;
 qa = Yc + 896 | 0;
 pa = Yc + 888 | 0;
 oa = Yc + 872 | 0;
 na = Yc + 856 | 0;
 ma = Yc + 848 | 0;
 la = Yc + 832 | 0;
 ka = Yc + 824 | 0;
 ja = Yc + 816 | 0;
 ia = Yc + 808 | 0;
 ha = Yc + 800 | 0;
 fa = Yc + 792 | 0;
 ea = Yc + 784 | 0;
 da = Yc + 768 | 0;
 ca = Yc + 752 | 0;
 ba = Yc + 744 | 0;
 aa = Yc + 728 | 0;
 $ = Yc + 720 | 0;
 _ = Yc + 712 | 0;
 Z = Yc + 704 | 0;
 Y = Yc + 696 | 0;
 X = Yc + 688 | 0;
 W = Yc + 680 | 0;
 V = Yc + 672 | 0;
 U = Yc + 664 | 0;
 T = Yc + 656 | 0;
 S = Yc + 640 | 0;
 R = Yc + 632 | 0;
 Q = Yc + 624 | 0;
 O = Yc + 616 | 0;
 N = Yc + 608 | 0;
 M = Yc + 600 | 0;
 L = Yc + 584 | 0;
 K = Yc + 576 | 0;
 J = Yc + 568 | 0;
 I = Yc + 560 | 0;
 H = Yc + 552 | 0;
 G = Yc + 544 | 0;
 F = Yc + 536 | 0;
 E = Yc + 528 | 0;
 D = Yc + 520 | 0;
 C = Yc + 512 | 0;
 B = Yc + 496 | 0;
 A = Yc + 488 | 0;
 z = Yc + 480 | 0;
 y = Yc + 472 | 0;
 x = Yc + 456 | 0;
 w = Yc + 448 | 0;
 v = Yc + 440 | 0;
 u = Yc + 424 | 0;
 t = Yc + 416 | 0;
 s = Yc + 400 | 0;
 r = Yc + 392 | 0;
 q = Yc + 384 | 0;
 p = Yc + 376 | 0;
 o = Yc + 368 | 0;
 n = Yc + 360 | 0;
 l = Yc + 352 | 0;
 k = Yc + 344 | 0;
 j = Yc + 336 | 0;
 h = Yc + 328 | 0;
 g = Yc + 320 | 0;
 f = Yc + 304 | 0;
 e = Yc + 296 | 0;
 Dc = Yc + 288 | 0;
 Cc = Yc + 272 | 0;
 Bc = Yc + 264 | 0;
 zc = Yc + 256 | 0;
 yc = Yc + 248 | 0;
 oc = Yc + 232 | 0;
 ec = Yc + 224 | 0;
 Xb = Yc + 216 | 0;
 Jb = Yc + 200 | 0;
 Bb = Yc + 192 | 0;
 qb = Yc + 184 | 0;
 eb = Yc + 168 | 0;
 Ga = Yc + 128 | 0;
 va = Yc + 120 | 0;
 ga = Yc + 104 | 0;
 P = Yc + 80 | 0;
 m = Yc + 40 | 0;
 Ac = Yc + 32 | 0;
 Ca = Yc + 16 | 0;
 d = Yc;
 Pc = Yc + 2200 | 0;
 Qc = Yc + 2196 | 0;
 Sc = Yc + 2192 | 0;
 Jc = Yc + 2188 | 0;
 Lc = Yc + 2184 | 0;
 Rc = Yc + 2180 | 0;
 c[Pc >> 2] = a;
 c[Qc >> 2] = b;
 do switch (c[Qc >> 2] | 0) {
 case 0:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16676;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[d >> 2] = 16689;
   c[d + 4 >> 2] = 16697;
   c[d + 8 >> 2] = 16708;
   c[d + 12 >> 2] = 0;
   pf(Dc, Cc, 16679, d);
   c[Ca >> 2] = 16697;
   c[Ca + 4 >> 2] = 16708;
   c[Ca + 8 >> 2] = 0;
   c[Sc >> 2] = qf(16689, Ca) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Ac >> 2] = 16676;
   c[Ac + 4 >> 2] = 0;
   df(Cc, Dc, 0, Ac);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 1:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[m >> 2] = 16725;
   c[m + 4 >> 2] = 16734;
   c[m + 8 >> 2] = 16748;
   c[m + 12 >> 2] = 16755;
   c[m + 16 >> 2] = 16773;
   c[m + 20 >> 2] = 16779;
   c[m + 24 >> 2] = 16792;
   c[m + 28 >> 2] = 16798;
   c[m + 32 >> 2] = 0;
   rf(Cc, Dc, 16717, m);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16650;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[P >> 2] = 16812;
   c[P + 4 >> 2] = 16820;
   c[P + 8 >> 2] = 16697;
   c[P + 12 >> 2] = 16708;
   c[P + 16 >> 2] = 0;
   pf(Dc, Cc, 16679, P);
   c[ga >> 2] = 16820;
   c[ga + 4 >> 2] = 16697;
   c[ga + 8 >> 2] = 16708;
   c[ga + 12 >> 2] = 0;
   c[Sc >> 2] = qf(16812, ga) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[va >> 2] = 16650;
   c[va + 4 >> 2] = 0;
   df(Cc, Dc, 0, va);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 2:
  {
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[Ga >> 2] = 16725;
   c[Ga + 4 >> 2] = 16734;
   c[Ga + 8 >> 2] = 16748;
   c[Ga + 12 >> 2] = 16755;
   c[Ga + 16 >> 2] = 16773;
   c[Ga + 20 >> 2] = 16779;
   c[Ga + 24 >> 2] = 16792;
   c[Ga + 28 >> 2] = 16798;
   c[Ga + 32 >> 2] = 0;
   rf(Dc, Cc, 16717, Ga);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16827;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[eb >> 2] = 16697;
   c[eb + 4 >> 2] = 16708;
   c[eb + 8 >> 2] = 0;
   pf(Cc, Dc, 16679, eb);
   c[qb >> 2] = 16708;
   c[qb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(16697, qb) | 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 3:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Bb >> 2] = 0;
   rf(Cc, Dc, 16839, Bb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16660;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Jb >> 2] = 16848;
   c[Jb + 4 >> 2] = 16708;
   c[Jb + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Jb);
   c[Xb >> 2] = 16708;
   c[Xb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(16848, Xb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ec >> 2] = 16857;
   c[ec + 4 >> 2] = 0;
   df(Cc, Dc, 0, ec);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 4:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16862;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[oc >> 2] = 16866;
   c[oc + 4 >> 2] = 16708;
   c[oc + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, oc);
   c[yc >> 2] = 16708;
   c[yc + 4 >> 2] = 0;
   c[Sc >> 2] = qf(16866, yc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[zc >> 2] = 16875;
   c[zc + 4 >> 2] = 0;
   df(Cc, Dc, 0, zc);
   break;
  }
 case 5:
  {
   zc = c[Pc >> 2] | 0;
   Ac = c[Qc >> 2] | 0;
   c[Bc >> 2] = 0;
   rf(zc, Ac, 16880, Bc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16889;
   Ac = c[Pc >> 2] | 0;
   Bc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Cc >> 2] = 16894;
   c[Cc + 4 >> 2] = 16902;
   c[Cc + 8 >> 2] = 0;
   pf(Ac, Bc, 16679, Cc);
   c[Dc >> 2] = 16902;
   c[Dc + 4 >> 2] = 0;
   c[Sc >> 2] = qf(16894, Dc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[e >> 2] = 16911;
   c[e + 4 >> 2] = 0;
   df(Cc, Dc, 0, e);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 6:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16917;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[f >> 2] = 16921;
   c[f + 4 >> 2] = 16931;
   c[f + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, f);
   c[g >> 2] = 16931;
   c[g + 4 >> 2] = 0;
   c[Sc >> 2] = qf(16921, g) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[h >> 2] = 16938;
   c[h + 4 >> 2] = 0;
   df(Cc, Dc, 0, h);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 7:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16943;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[j >> 2] = 16947;
   c[j + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, j);
   c[k >> 2] = 0;
   c[Sc >> 2] = qf(16947, k) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[l >> 2] = 16957;
   c[l + 4 >> 2] = 0;
   df(Cc, Dc, 0, l);
   break;
  }
 case 8:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16962;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[n >> 2] = 17637;
   c[n + 4 >> 2] = 0;
   pf(Dc, Cc, 16966, n);
   c[o >> 2] = 0;
   c[Sc >> 2] = qf(17637, o) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[p >> 2] = 17646;
   c[p + 4 >> 2] = 0;
   df(Cc, Dc, 0, p);
   break;
  }
 case 9:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17651;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[q >> 2] = 17656;
   c[q + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, q);
   c[r >> 2] = 0;
   c[Sc >> 2] = qf(17656, r) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[s >> 2] = 17651;
   c[s + 4 >> 2] = 17665;
   c[s + 8 >> 2] = 0;
   df(Cc, Dc, 0, s);
   Dc = sf(c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 4 >> 2] | 0) | 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 4 >> 2] = Dc;
   break;
  }
 case 10:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[t >> 2] = 0;
   rf(Cc, Dc, 16880, t);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16664;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[u >> 2] = 17670;
   c[u + 4 >> 2] = 16902;
   c[u + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, u);
   c[v >> 2] = 16902;
   c[v + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17670, v) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[w >> 2] = 17681;
   c[w + 4 >> 2] = 0;
   df(Cc, Dc, 0, w);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 11:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17686;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[x >> 2] = 17690;
   c[x + 4 >> 2] = 16708;
   c[x + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, x);
   c[y >> 2] = 16708;
   c[y + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17690, y) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[z >> 2] = 17702;
   c[z + 4 >> 2] = 0;
   df(Cc, Dc, 0, z);
   break;
  }
 case 12:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[A >> 2] = 0;
   rf(Cc, Dc, 16880, A);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17707;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[B >> 2] = 17711;
   c[B + 4 >> 2] = 16902;
   c[B + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, B);
   c[C >> 2] = 16902;
   c[C + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17711, C) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[D >> 2] = 17718;
   c[D + 4 >> 2] = 0;
   df(Cc, Dc, 0, D);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 13:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[E >> 2] = 0;
   rf(Cc, Dc, 17723, E);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16653;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[F >> 2] = 17731;
   c[F + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, F);
   c[G >> 2] = 0;
   c[Sc >> 2] = qf(17731, G) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[H >> 2] = 17740;
   c[H + 4 >> 2] = 0;
   df(Cc, Dc, 0, H);
   break;
  }
 case 15:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17744;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[I >> 2] = 17748;
   c[I + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, I);
   c[J >> 2] = 0;
   c[Sc >> 2] = qf(17748, J) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[K >> 2] = 17758;
   c[K + 4 >> 2] = 0;
   df(Cc, Dc, 0, K);
   break;
  }
 case 14:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17763;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[L >> 2] = 17770;
   c[L + 4 >> 2] = 16902;
   c[L + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, L);
   c[M >> 2] = 16902;
   c[M + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17770, M) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[N >> 2] = 17777;
   c[N + 4 >> 2] = 0;
   df(Cc, Dc, 0, N);
   break;
  }
 case 16:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17783;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[O >> 2] = 17786;
   c[O + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, O);
   c[Q >> 2] = 0;
   c[Sc >> 2] = qf(17786, Q) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[R >> 2] = 17795;
   c[R + 4 >> 2] = 0;
   df(Cc, Dc, 0, R);
   break;
  }
 case 17:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17799;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[S >> 2] = 17806;
   c[S + 4 >> 2] = 16902;
   c[S + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, S);
   c[T >> 2] = 16902;
   c[T + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17806, T) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[U >> 2] = 17777;
   c[U + 4 >> 2] = 0;
   df(Cc, Dc, 0, U);
   break;
  }
 case 18:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17813;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[V >> 2] = 17830;
   c[V + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, V);
   c[W >> 2] = 0;
   c[Sc >> 2] = qf(17830, W) | 0;
   break;
  }
 case 19:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[X >> 2] = 0;
   rf(Cc, Dc, 17840, X);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16672;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Y >> 2] = 17846;
   c[Y + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, Y);
   c[Z >> 2] = 0;
   c[Sc >> 2] = qf(17846, Z) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[_ >> 2] = 17856;
   c[_ + 4 >> 2] = 0;
   df(Cc, Dc, 0, _);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 20:
  {
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[$ >> 2] = 0;
   rf(Cc, Dc, 17861, $);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16668;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[aa >> 2] = 17867;
   c[aa + 4 >> 2] = 16708;
   c[aa + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, aa);
   c[ba >> 2] = 16708;
   c[ba + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17867, ba) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ca >> 2] = 17876;
   c[ca + 4 >> 2] = 16857;
   c[ca + 8 >> 2] = 0;
   df(Cc, Dc, 0, ca);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 21:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17881;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[da >> 2] = 17885;
   c[da + 4 >> 2] = 16708;
   c[da + 8 >> 2] = 0;
   pf(Cc, Dc, 16679, da);
   c[ea >> 2] = 16708;
   c[ea + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17885, ea) | 0;
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[fa >> 2] = 17894;
   c[fa + 4 >> 2] = 0;
   df(Dc, Cc, 0, fa);
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ha >> 2] = 17899;
   c[ha + 4 >> 2] = 0;
   df(Cc, Dc, 1, ha);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 22:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17903;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[ia >> 2] = 17907;
   c[ia + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, ia);
   c[ja >> 2] = 0;
   c[Sc >> 2] = qf(17907, ja) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ka >> 2] = 17917;
   c[ka + 4 >> 2] = 0;
   df(Cc, Dc, 0, ka);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 23:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17922;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[la >> 2] = 17926;
   c[la + 4 >> 2] = 16708;
   c[la + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, la);
   c[ma >> 2] = 16708;
   c[ma + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17926, ma) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[na >> 2] = 17935;
   c[na + 4 >> 2] = 17940;
   c[na + 8 >> 2] = 0;
   df(Cc, Dc, 0, na);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 24:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17944;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[oa >> 2] = 17948;
   c[oa + 4 >> 2] = 16708;
   c[oa + 8 >> 2] = 0;
   pf(Cc, Dc, 16679, oa);
   c[pa >> 2] = 16708;
   c[pa + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17948, pa) | 0;
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[qa >> 2] = 17957;
   c[qa + 4 >> 2] = 0;
   df(Dc, Cc, 0, qa);
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ra >> 2] = 17962;
   c[ra + 4 >> 2] = 0;
   df(Cc, Dc, 1, ra);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 25:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 17967;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[sa >> 2] = 17982;
   c[sa + 4 >> 2] = 17991;
   c[sa + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, sa);
   c[ta >> 2] = 17991;
   c[ta + 4 >> 2] = 0;
   c[Sc >> 2] = qf(17982, ta) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ua >> 2] = 18001;
   c[ua + 4 >> 2] = 18006;
   c[ua + 8 >> 2] = 0;
   df(Cc, Dc, 1, ua);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 26:
  {
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[wa >> 2] = 0;
   rf(Dc, Cc, 18012, wa);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 16656;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[xa >> 2] = 17991;
   c[xa + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, xa);
   c[ya >> 2] = 0;
   c[Sc >> 2] = qf(17991, ya) | 0;
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[za >> 2] = 18021;
   c[za + 4 >> 2] = 0;
   df(Dc, Cc, 0, za);
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Aa >> 2] = 18026;
   c[Aa + 4 >> 2] = 18031;
   c[Aa + 8 >> 2] = 18036;
   c[Aa + 12 >> 2] = 18040;
   c[Aa + 16 >> 2] = 18045;
   c[Aa + 20 >> 2] = 18050;
   c[Aa + 24 >> 2] = 18055;
   c[Aa + 28 >> 2] = 18060;
   c[Aa + 32 >> 2] = 0;
   df(Cc, Dc, 1, Aa);
   break;
  }
 case 30:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18065;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ba >> 2] = 18083;
   c[Ba + 4 >> 2] = 18096;
   c[Ba + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Ba);
   c[Da >> 2] = 18096;
   c[Da + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18083, Da) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Ea >> 2] = 18106;
   c[Ea + 4 >> 2] = 0;
   df(Cc, Dc, 1, Ea);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 27:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18111;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Fa >> 2] = 18136;
   c[Fa + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, Fa);
   c[Ha >> 2] = 0;
   c[Sc >> 2] = qf(18136, Ha) | 0;
   break;
  }
 case 28:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18144;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ia >> 2] = 18152;
   c[Ia + 4 >> 2] = 16902;
   c[Ia + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Ia);
   c[Ja >> 2] = 16902;
   c[Ja + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18152, Ja) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Ka >> 2] = 17777;
   c[Ka + 4 >> 2] = 0;
   df(Cc, Dc, 0, Ka);
   break;
  }
 case 29:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18160;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[La >> 2] = 18179;
   c[La + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, La);
   c[Ma >> 2] = 0;
   c[Sc >> 2] = qf(18179, Ma) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Na >> 2] = 18190;
   c[Na + 4 >> 2] = 18195;
   c[Na + 8 >> 2] = 0;
   df(Cc, Dc, 1, Na);
   break;
  }
 case 31:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18200;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Oa >> 2] = 18269;
   c[Oa + 4 >> 2] = 0;
   pf(Cc, Dc, 18212, Oa);
   c[Pa >> 2] = 0;
   c[Sc >> 2] = qf(18269, Pa) | 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 32:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18277;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Qa >> 2] = 18289;
   c[Qa + 4 >> 2] = 18297;
   c[Qa + 8 >> 2] = 16708;
   c[Qa + 12 >> 2] = 18083;
   c[Qa + 16 >> 2] = 18096;
   c[Qa + 20 >> 2] = 0;
   pf(Dc, Cc, 16679, Qa);
   c[Ra >> 2] = 18297;
   c[Ra + 4 >> 2] = 16708;
   c[Ra + 8 >> 2] = 18083;
   c[Ra + 12 >> 2] = 18096;
   c[Ra + 16 >> 2] = 0;
   c[Sc >> 2] = qf(18289, Ra) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Sa >> 2] = 18306;
   c[Sa + 4 >> 2] = 18311;
   c[Sa + 8 >> 2] = 0;
   df(Cc, Dc, 0, Sa);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 33:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18316;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ta >> 2] = 18319;
   c[Ta + 4 >> 2] = 16708;
   c[Ta + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Ta);
   c[Ua >> 2] = 16708;
   c[Ua + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18319, Ua) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Va >> 2] = 17940;
   c[Va + 4 >> 2] = 0;
   df(Cc, Dc, 0, Va);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 34:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18327;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Wa >> 2] = 18340;
   c[Wa + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, Wa);
   c[Xa >> 2] = 0;
   c[Sc >> 2] = qf(18340, Xa) | 0;
   break;
  }
 case 35:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18350;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ya >> 2] = 18354;
   c[Ya + 4 >> 2] = 18368;
   c[Ya + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Ya);
   c[Za >> 2] = 18368;
   c[Za + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18354, Za) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[$a >> 2] = 18379;
   c[$a + 4 >> 2] = 0;
   df(Cc, Dc, 0, $a);
   break;
  }
 case 36:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18384;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[ab >> 2] = 18399;
   c[ab + 4 >> 2] = 16708;
   c[ab + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, ab);
   c[bb >> 2] = 16708;
   c[bb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18399, bb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[cb >> 2] = 18407;
   c[cb + 4 >> 2] = 18412;
   c[cb + 8 >> 2] = 18417;
   c[cb + 12 >> 2] = 18422;
   c[cb + 16 >> 2] = 18427;
   c[cb + 20 >> 2] = 0;
   df(Cc, Dc, 0, cb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 37:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18434;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[db >> 2] = 18447;
   c[db + 4 >> 2] = 16708;
   c[db + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, db);
   c[fb >> 2] = 16708;
   c[fb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18447, fb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[gb >> 2] = 18456;
   c[gb + 4 >> 2] = 18461;
   c[gb + 8 >> 2] = 0;
   df(Cc, Dc, 0, gb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 38:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18466;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[hb >> 2] = 18478;
   c[hb + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, hb);
   c[ib >> 2] = 0;
   c[Sc >> 2] = qf(18478, ib) | 0;
   break;
  }
 case 39:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18484;
   Bc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   Dc = c[(c[Pc >> 2] | 0) + 112 >> 2] | 0;
   c[jb >> 2] = 20541;
   c[jb + 4 >> 2] = 18501;
   c[jb + 8 >> 2] = Dc;
   c[jb + 12 >> 2] = 18509;
   c[jb + 16 >> 2] = 0;
   Dc = Ff(34049, jb) | 0;
   c[kb >> 2] = Df(_g(c[(c[Pc >> 2] | 0) + 112 >> 2] | 0) | 0, 18512) | 0;
   c[kb + 4 >> 2] = 0;
   pf(Bc, Cc, Dc, kb);
   Dc = Df(_g(c[(c[Pc >> 2] | 0) + 112 >> 2] | 0) | 0, 18512) | 0;
   c[lb >> 2] = 0;
   c[Sc >> 2] = qf(Dc, lb) | 0;
   break;
  }
 case 40:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18519;
   Bc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   Dc = c[(c[Pc >> 2] | 0) + 112 >> 2] | 0;
   c[mb >> 2] = 20541;
   c[mb + 4 >> 2] = 18501;
   c[mb + 8 >> 2] = Dc;
   c[mb + 12 >> 2] = 18509;
   c[mb + 16 >> 2] = 0;
   Dc = Ff(34049, mb) | 0;
   c[nb >> 2] = Df(_g(c[(c[Pc >> 2] | 0) + 112 >> 2] | 0) | 0, 18512) | 0;
   c[nb + 4 >> 2] = 0;
   pf(Bc, Cc, Dc, nb);
   Dc = Df(_g(c[(c[Pc >> 2] | 0) + 112 >> 2] | 0) | 0, 18512) | 0;
   c[ob >> 2] = 0;
   c[Sc >> 2] = qf(Dc, ob) | 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 41:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18538;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[pb >> 2] = 18549;
   c[pb + 4 >> 2] = 16708;
   c[pb + 8 >> 2] = 0;
   pf(Cc, Dc, 16679, pb);
   c[rb >> 2] = 16708;
   c[rb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18549, rb) | 0;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 42:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18559;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[sb >> 2] = 18563;
   c[sb + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, sb);
   c[tb >> 2] = 0;
   c[Sc >> 2] = qf(18563, tb) | 0;
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[ub >> 2] = 18573;
   c[ub + 4 >> 2] = 0;
   df(Dc, Cc, 0, ub);
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[vb >> 2] = 18578;
   c[vb + 4 >> 2] = 0;
   df(Cc, Dc, 1, vb);
   break;
  }
 case 43:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18582;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[wb >> 2] = 18587;
   c[wb + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, wb);
   c[xb >> 2] = 0;
   c[Sc >> 2] = qf(18587, xb) | 0;
   Dc = c[Pc >> 2] | 0;
   Cc = c[Qc >> 2] | 0;
   c[yb >> 2] = 18598;
   c[yb + 4 >> 2] = 18573;
   c[yb + 8 >> 2] = 0;
   df(Dc, Cc, 0, yb);
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[zb >> 2] = 18578;
   c[zb + 4 >> 2] = 0;
   df(Cc, Dc, 1, zb);
   break;
  }
 case 44:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18601;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ab >> 2] = 18611;
   c[Ab + 4 >> 2] = 16708;
   c[Ab + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Ab);
   c[Cb >> 2] = 16708;
   c[Cb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18611, Cb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Db >> 2] = 18620;
   c[Db + 4 >> 2] = 0;
   df(Cc, Dc, 0, Db);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 45:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18625;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Eb >> 2] = 18636;
   c[Eb + 4 >> 2] = 16708;
   c[Eb + 8 >> 2] = 0;
   pf(Cc, Dc, 16679, Eb);
   c[Fb >> 2] = 16708;
   c[Fb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18636, Fb) | 0;
   break;
  }
 case 46:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18646;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Gb >> 2] = 18671;
   c[Gb + 4 >> 2] = 16708;
   c[Gb + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Gb);
   c[Hb >> 2] = 16708;
   c[Hb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18671, Hb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Ib >> 2] = 18680;
   c[Ib + 4 >> 2] = 0;
   df(Cc, Dc, 0, Ib);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 47:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18685;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Kb >> 2] = 18700;
   c[Kb + 4 >> 2] = 16708;
   c[Kb + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Kb);
   c[Lb >> 2] = 16708;
   c[Lb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18700, Lb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Mb >> 2] = 18714;
   c[Mb + 4 >> 2] = 0;
   df(Cc, Dc, 0, Mb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2] = 1;
   break;
  }
 case 48:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18719;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Nb >> 2] = 18733;
   c[Nb + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, Nb);
   c[Ob >> 2] = 0;
   c[Sc >> 2] = qf(18733, Ob) | 0;
   break;
  }
 case 49:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18746;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Pb >> 2] = 18756;
   c[Pb + 4 >> 2] = 16708;
   c[Pb + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, Pb);
   c[Qb >> 2] = 16708;
   c[Qb + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18756, Qb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Rb >> 2] = 18765;
   c[Rb + 4 >> 2] = 0;
   df(Cc, Dc, 0, Rb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 50:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18770;
   Cc = c[Pc >> 2] | 0;
   Dc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Sb >> 2] = 18783;
   c[Sb + 4 >> 2] = 0;
   pf(Cc, Dc, 16679, Sb);
   c[Tb >> 2] = 0;
   c[Sc >> 2] = qf(18783, Tb) | 0;
   break;
  }
 case 51:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18796;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Ub >> 2] = 18800;
   c[Ub + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, Ub);
   c[Vb >> 2] = 0;
   c[Sc >> 2] = qf(18800, Vb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[Wb >> 2] = 18810;
   c[Wb + 4 >> 2] = 18815;
   c[Wb + 8 >> 2] = 18823;
   c[Wb + 12 >> 2] = 18828;
   c[Wb + 16 >> 2] = 18836;
   c[Wb + 20 >> 2] = 18844;
   c[Wb + 24 >> 2] = 18852;
   c[Wb + 28 >> 2] = 0;
   df(Cc, Dc, 0, Wb);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 52:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18857;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[Yb >> 2] = 18876;
   c[Yb + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, Yb);
   c[Zb >> 2] = 0;
   c[Sc >> 2] = qf(18876, Zb) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[_b >> 2] = 18889;
   c[_b + 4 >> 2] = 0;
   df(Cc, Dc, 0, _b);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 53:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18894;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[$b >> 2] = 18903;
   c[$b + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, $b);
   c[ac >> 2] = 0;
   c[Sc >> 2] = qf(18903, ac) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[bc >> 2] = 18915;
   c[bc + 4 >> 2] = 18920;
   c[bc + 8 >> 2] = 0;
   df(Cc, Dc, 0, bc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 54:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18928;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[cc >> 2] = 18934;
   c[cc + 4 >> 2] = 16921;
   c[cc + 8 >> 2] = 16931;
   c[cc + 12 >> 2] = 0;
   pf(Dc, Cc, 16679, cc);
   c[dc >> 2] = 16921;
   c[dc + 4 >> 2] = 16931;
   c[dc + 8 >> 2] = 0;
   c[Sc >> 2] = qf(18934, dc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[fc >> 2] = 18946;
   c[fc + 4 >> 2] = 16938;
   c[fc + 8 >> 2] = 0;
   df(Cc, Dc, 0, fc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 55:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18953;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[gc >> 2] = 18959;
   c[gc + 4 >> 2] = 16947;
   c[gc + 8 >> 2] = 0;
   pf(Dc, Cc, 16679, gc);
   c[hc >> 2] = 16947;
   c[hc + 4 >> 2] = 0;
   c[Sc >> 2] = qf(18959, hc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[ic >> 2] = 18971;
   c[ic + 4 >> 2] = 16957;
   c[ic + 8 >> 2] = 0;
   df(Cc, Dc, 0, ic);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 56:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 18978;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[jc >> 2] = 19029;
   c[jc + 4 >> 2] = 0;
   pf(Dc, Cc, 18983, jc);
   c[kc >> 2] = 0;
   c[Sc >> 2] = qf(19029, kc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[lc >> 2] = 19040;
   c[lc + 4 >> 2] = 19045;
   c[lc + 8 >> 2] = 0;
   df(Cc, Dc, 0, lc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 57:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 19049;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[mc >> 2] = 19053;
   c[mc + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, mc);
   c[nc >> 2] = 0;
   c[Sc >> 2] = qf(19053, nc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[pc >> 2] = 19063;
   c[pc + 4 >> 2] = 0;
   df(Cc, Dc, 0, pc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 case 58:
  {
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2] = 19068;
   Dc = c[Pc >> 2] | 0;
   Cc = (c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) | 0;
   c[qc >> 2] = 19075;
   c[qc + 4 >> 2] = 0;
   pf(Dc, Cc, 16679, qc);
   c[rc >> 2] = 0;
   c[Sc >> 2] = qf(19075, rc) | 0;
   Cc = c[Pc >> 2] | 0;
   Dc = c[Qc >> 2] | 0;
   c[sc >> 2] = 19088;
   c[sc + 4 >> 2] = 0;
   df(Cc, Dc, 0, sc);
   c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2] = 1;
   break;
  }
 default:
  {
   Dc = c[1840] | 0;
   c[tc >> 2] = c[(c[Pc >> 2] | 0) + 104 >> 2];
   $i(Dc, 29435, tc) | 0;
   Dc = c[1840] | 0;
   c[uc >> 2] = c[Qc >> 2];
   $i(Dc, 19096, uc) | 0;
   Qi(29463, c[1840] | 0) | 0;
   _a(1);
  }
 } while (0);
 if (!(c[(c[Pc >> 2] | 0) + 44 >> 2] & 8)) {
  Xc = c[Sc >> 2] | 0;
  i = Yc;
  return Xc | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 Dc = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 12 >> 2] | 0;
 c[vc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) >> 2];
 c[vc + 4 >> 2] = Dc;
 $i(b, 19132, vc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 c[wc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 4 >> 2];
 $i(b, 19168, wc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 c[xc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 8 >> 2];
 $i(b, 19176, xc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 16 >> 2] | 0) a = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 16 >> 2] | 0; else a = 19201;
 c[Ec >> 2] = a;
 $i(b, 19208, Ec) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 20 >> 2] | 0) a = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 20 >> 2] | 0; else a = 19201;
 c[Fc >> 2] = a;
 $i(b, 19242, Fc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 24 >> 2] | 0) a = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 24 >> 2] | 0; else a = 19201;
 c[Gc >> 2] = a;
 $i(b, 19279, Gc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 28 >> 2] | 0) a = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 28 >> 2] | 0; else a = 19201;
 c[Hc >> 2] = a;
 $i(b, 19302, Hc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Hc = c[1840] | 0;
 c[Ic >> 2] = c[Sc >> 2];
 $i(Hc, 19328, Ic) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Qi(19358, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 32 >> 2] | 0) {
  c[Jc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 32 >> 2];
  while (1) {
   if (c[Jc >> 2] | 0) a = (c[c[Jc >> 2] >> 2] | 0) != 0; else a = 0;
   b = c[1840] | 0;
   if (!a) break;
   c[Kc >> 2] = c[c[Jc >> 2] >> 2];
   $i(b, 29169, Kc) | 0;
   c[Jc >> 2] = (c[Jc >> 2] | 0) + 4;
  }
  Vi(10, b) | 0;
 } else Qi(19379, c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Qi(19388, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 36 >> 2] | 0) {
  c[Lc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 36 >> 2];
  while (1) {
   if (c[Lc >> 2] | 0) a = (c[c[Lc >> 2] >> 2] | 0) != 0; else a = 0;
   b = c[1840] | 0;
   if (!a) break;
   c[Mc >> 2] = c[c[Lc >> 2] >> 2];
   $i(b, 29169, Mc) | 0;
   c[Lc >> 2] = (c[Lc >> 2] | 0) + 4;
  }
  Vi(10, b) | 0;
 } else Qi(19379, c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 c[Nc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 40 >> 2];
 $i(b, 19407, Nc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 b = c[1840] | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 44 >> 2] | 0) a = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 44 >> 2] | 0; else a = 19201;
 c[Oc >> 2] = a;
 $i(b, 19439, Oc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Qi(19474, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 if (c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 52 >> 2] | 0) {
  c[Rc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 52 >> 2];
  while (1) {
   b = c[1840] | 0;
   if (!(c[c[Rc >> 2] >> 2] | 0)) break;
   c[Tc >> 2] = c[c[Rc >> 2] >> 2];
   $i(b, 29169, Tc) | 0;
   c[Rc >> 2] = (c[Rc >> 2] | 0) + 4;
  }
  Vi(10, b) | 0;
 } else Qi(19379, c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Tc = c[1840] | 0;
 c[Uc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 56 >> 2];
 $i(Tc, 19505, Uc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Uc = c[1840] | 0;
 c[Vc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 60 >> 2];
 $i(Uc, 19529, Vc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Vc = c[1840] | 0;
 c[Wc >> 2] = c[(c[Pc >> 2] | 0) + 132 + ((c[Qc >> 2] | 0) * 68 | 0) + 64 >> 2];
 $i(Vc, 19558, Wc) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Wc = c[1840] | 0;
 c[Xc >> 2] = c[Qc >> 2];
 $i(Wc, 19592, Xc) | 0;
 ij(c[1840] | 0) | 0;
 Xc = c[Sc >> 2] | 0;
 i = Yc;
 return Xc | 0;
}

function Ne() {
 var a = 0, b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0;
 A = i;
 i = i + 192 | 0;
 x = A + 184 | 0;
 w = A + 176 | 0;
 v = A + 160 | 0;
 u = A + 144 | 0;
 t = A + 136 | 0;
 s = A + 128 | 0;
 r = A + 112 | 0;
 q = A + 96 | 0;
 p = A + 88 | 0;
 m = A + 80 | 0;
 l = A + 64 | 0;
 k = A + 48 | 0;
 j = A + 24 | 0;
 h = A + 16 | 0;
 g = A + 8 | 0;
 f = A;
 z = 4;
 y = Bj(40) | 0;
 c[y >> 2] = 0;
 c[719] = c[1837];
 c[12] = c[1838];
 c[65] = 65e3;
 c[14] = 2e4;
 c[689] = 20;
 c[716] = 10;
 c[170] = 5e3;
 c[120] = 750;
 c[336] = 3e3;
 c[385] = 50;
 n = 0;
 ha(1);
 a = n;
 n = 0;
 if ((a | 0) != 0 & (o | 0) != 0) {
  b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
  if (!b) xa(a | 0, o | 0);
  C = o;
 } else b = -1;
 a = C;
 a : do switch (b | 0) {
 case 1:
  {
   b = 61;
   break;
  }
 case 2:
  {
   b = 33;
   break;
  }
 default:
  {
   n = 0;
   e = ga(2, (c[689] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[338] = e;
   n = 0;
   b = ga(2, (c[689] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[116] = b;
   c[391] = 0;
   c[280] = 0;
   n = 0;
   b = ga(2, (c[336] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[337] = b;
   n = 0;
   b = ga(2, (c[170] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[171] = b;
   n = 0;
   b = ga(2, (c[689] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[347] = b;
   n = 0;
   b = ga(2, (c[65] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[64] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[15] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[16] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[17] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[18] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[19] = b;
   n = 0;
   b = ga(2, (c[14] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[20] = b;
   n = 0;
   b = ga(2, c[716] << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[395] = b;
   b = _(c[716] | 0, (c[329] | 0) + 1 | 0) | 0;
   n = 0;
   b = ga(2, b | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[397] = b;
   n = 0;
   b = ga(2, c[716] << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[398] = b;
   n = 0;
   b = ga(2, (c[120] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[121] = b;
   n = 0;
   b = ga(2, (c[120] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[122] = b;
   n = 0;
   b = ga(2, (c[120] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[123] = b;
   n = 0;
   b = ga(2, (c[120] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[124] = b;
   n = 0;
   b = ga(2, (c[23] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[63] = b;
   n = 0;
   b = ga(2, (c[717] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[265] = b;
   n = 0;
   b = ga(2, (c[717] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[167] = b;
   n = 0;
   b = ga(2, (c[717] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[264] = b;
   n = 0;
   b = ga(2, (c[717] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[271] = b;
   n = 0;
   b = ga(2, (c[717] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[166] = b;
   n = 0;
   b = ga(2, (c[385] | 0) + 1 << 2 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[383] = b;
   n = 0;
   b = ga(2, (c[385] | 0) + 1 | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!e) xa(a | 0, o | 0);
    C = o;
   } else e = -1;
   a = C;
   switch (e | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   c[384] = b;
   n = 0;
   ha(2);
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   n = 0;
   ha(3);
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   y = Mj(96, 2, y | 0, z | 0) | 0;
   z = C;
   n = 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     break a;
    }
   case 2:
    {
     b = 33;
     break a;
    }
   default:
    {}
   }
   a = 0;
   b = 33;
  }
 } while (0);
 b : while (1) {
  if ((b | 0) == 33) {
   b = 0;
   if ((a | 0) != 1) {
    b = (c[691] | 0) != 0;
    n = 0;
    ia(1, 13747, c[11] | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!e) xa(a | 0, o | 0);
     C = o;
    } else e = -1;
    a = C;
    switch (e | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    if (b) {
     n = 0;
     ia(1, 13747, c[12] | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[11] | 0;
     n = 0;
     c[f >> 2] = c[730];
     da(6, a | 0, 16602, f | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[12] | 0;
     n = 0;
     c[g >> 2] = c[730];
     da(6, a | 0, 16602, g | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
    } else {
     a = c[11] | 0;
     n = 0;
     c[h >> 2] = c[730];
     da(6, a | 0, 16602, h | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
    }
    a = c[11] | 0;
    B = c[23] | 0;
    b = c[267] | 0;
    e = c[262] | 0;
    n = 0;
    c[j >> 2] = 15393;
    c[j + 4 >> 2] = B;
    c[j + 8 >> 2] = 15416;
    c[j + 12 >> 2] = b;
    c[j + 16 >> 2] = 15429;
    c[j + 20 >> 2] = e;
    da(6, a | 0, 15376, j | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    b = (c[691] | 0) != 0;
    n = 0;
    ia(1, 15443, c[11] | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!e) xa(a | 0, o | 0);
     C = o;
    } else e = -1;
    a = C;
    switch (e | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    if (b) {
     n = 0;
     ia(1, 15443, c[12] | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     n = 0;
     ha(4);
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
    } else {
     n = 0;
     ha(5);
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
    }
    while (1) {
     if (c[10] | 0) break;
     c[376 + (c[72] << 2) >> 2] = (c[376 + (c[72] << 2) >> 2] | 0) + 1;
     n = 0;
     b = ga(3, c[2664 + (c[72] << 2) >> 2] | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!e) xa(a | 0, o | 0);
      C = o;
     } else e = -1;
     a = C;
     switch (e | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     if (b) {
      n = 0;
      ha(7);
      a = n;
      n = 0;
      if ((a | 0) != 0 & (o | 0) != 0) {
       b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
       if (!b) xa(a | 0, o | 0);
       C = o;
      } else b = -1;
      a = C;
      switch (b | 0) {
      case 1:
       {
        b = 61;
        continue b;
       }
      case 2:
       {
        b = 33;
        continue b;
       }
      default:
       {}
      }
      continue;
     } else {
      n = 0;
      ha(6);
      a = n;
      n = 0;
      if ((a | 0) != 0 & (o | 0) != 0) {
       b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
       if (!b) xa(a | 0, o | 0);
       C = o;
      } else b = -1;
      a = C;
      switch (b | 0) {
      case 1:
       {
        b = 61;
        continue b;
       }
      case 2:
       {
        b = 33;
        continue b;
       }
      default:
       {}
      }
      continue;
     }
    }
    n = 0;
    ha(8);
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    if (!(c[118] | 0)) b = 68; else {
     c[125] = 0;
     c[178] = 1;
     c[67] = c[21];
     y = Mj(508, 1, y | 0, z | 0) | 0;
     z = C;
     n = 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = 0;
     b = 61;
     continue;
    }
   }
  } else if ((b | 0) == 61) {
   c : do if (!a) while (1) {
    n = 0;
    b = ea(1) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     e = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!e) xa(a | 0, o | 0);
     C = o;
    } else e = -1;
    a = C;
    switch (e | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    if (!b) break c;
    n = 0;
    ha(9);
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
   } while (0);
   n = 0;
   fa(1, c[126] | 0);
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     continue b;
    }
   case 2:
    {
     b = 33;
     continue b;
    }
   default:
    {}
   }
   b = 68;
  }
  if ((b | 0) == 68) {
   n = 0;
   fa(1, c[177] | 0);
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     continue b;
    }
   case 2:
    {
     b = 33;
     continue b;
    }
   default:
    {}
   }
  }
  if (!((c[706] | 0) == 0 | (c[707] | 0) != 0)) {
   a = c[11] | 0;
   B = c[168] | 0;
   n = 0;
   c[k >> 2] = 15474;
   c[k + 4 >> 2] = B;
   c[k + 8 >> 2] = 9781;
   da(6, a | 0, 9764, k | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     continue b;
    }
   case 2:
    {
     b = 33;
     continue b;
    }
   default:
    {}
   }
   a = c[12] | 0;
   B = c[168] | 0;
   n = 0;
   c[l >> 2] = 15474;
   c[l + 4 >> 2] = B;
   c[l + 8 >> 2] = 9781;
   da(6, a | 0, 9764, l | 0) | 0;
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     continue b;
    }
   case 2:
    {
     b = 33;
     continue b;
    }
   default:
    {}
   }
   n = 0;
   ha(10);
   a = n;
   n = 0;
   if ((a | 0) != 0 & (o | 0) != 0) {
    b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
    if (!b) xa(a | 0, o | 0);
    C = o;
   } else b = -1;
   a = C;
   switch (b | 0) {
   case 1:
    {
     b = 61;
     continue b;
    }
   case 2:
    {
     b = 33;
     continue b;
    }
   default:
    {}
   }
  }
  n = 0;
  ha(11);
  a = n;
  n = 0;
  if ((a | 0) != 0 & (o | 0) != 0) {
   b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
   if (!b) xa(a | 0, o | 0);
   C = o;
  } else b = -1;
  a = C;
  switch (b | 0) {
  case 1:
   {
    b = 61;
    continue b;
   }
  case 2:
   {
    b = 33;
    continue b;
   }
  default:
   {}
  }
  d : do switch (d[8356] | 0 | 0) {
  case 0:
   break;
  case 1:
   {
    a = c[11] | 0;
    if ((c[13] | 0) == 1) {
     n = 0;
     c[m >> 2] = 15491;
     da(6, a | 0, 16602, m | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[12] | 0;
     n = 0;
     c[p >> 2] = 15491;
     da(6, a | 0, 16602, p | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     break d;
    } else {
     B = c[13] | 0;
     n = 0;
     c[q >> 2] = 15513;
     c[q + 4 >> 2] = B;
     c[q + 8 >> 2] = 15526;
     da(6, a | 0, 11218, q | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[12] | 0;
     B = c[13] | 0;
     n = 0;
     c[r >> 2] = 15513;
     c[r + 4 >> 2] = B;
     c[r + 8 >> 2] = 15526;
     da(6, a | 0, 11218, r | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     break d;
    }
   }
  case 2:
   {
    a = c[11] | 0;
    if ((c[13] | 0) == 1) {
     n = 0;
     c[s >> 2] = 15537;
     da(6, a | 0, 16602, s | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[12] | 0;
     n = 0;
     c[t >> 2] = 15537;
     da(6, a | 0, 16602, t | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     break d;
    } else {
     B = c[13] | 0;
     n = 0;
     c[u >> 2] = 15513;
     c[u + 4 >> 2] = B;
     c[u + 8 >> 2] = 15565;
     da(6, a | 0, 11218, u | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     a = c[12] | 0;
     B = c[13] | 0;
     n = 0;
     c[v >> 2] = 15513;
     c[v + 4 >> 2] = B;
     c[v + 8 >> 2] = 15565;
     da(6, a | 0, 11218, v | 0) | 0;
     a = n;
     n = 0;
     if ((a | 0) != 0 & (o | 0) != 0) {
      b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
      if (!b) xa(a | 0, o | 0);
      C = o;
     } else b = -1;
     a = C;
     switch (b | 0) {
     case 1:
      {
       b = 61;
       continue b;
      }
     case 2:
      {
       b = 33;
       continue b;
      }
     default:
      {}
     }
     break d;
    }
   }
  case 3:
   {
    a = c[11] | 0;
    n = 0;
    c[w >> 2] = 15582;
    da(6, a | 0, 16602, w | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    a = c[12] | 0;
    n = 0;
    c[x >> 2] = 15582;
    da(6, a | 0, 16602, x | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    break;
   }
  default:
   {
    n = 0;
    ia(1, 15607, c[11] | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    n = 0;
    ia(1, 15607, c[12] | 0) | 0;
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
    n = 0;
    ha(12);
    a = n;
    n = 0;
    if ((a | 0) != 0 & (o | 0) != 0) {
     b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
     if (!b) xa(a | 0, o | 0);
     C = o;
    } else b = -1;
    a = C;
    switch (b | 0) {
    case 1:
     {
      b = 61;
      continue b;
     }
    case 2:
     {
      b = 33;
      continue b;
     }
    default:
     {}
    }
   }
  } while (0);
  n = 0;
  fa(1, c[11] | 0);
  a = n;
  n = 0;
  if ((a | 0) != 0 & (o | 0) != 0) {
   b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
   if (!b) xa(a | 0, o | 0);
   C = o;
  } else b = -1;
  a = C;
  switch (b | 0) {
  case 1:
   {
    b = 61;
    continue b;
   }
  case 2:
   {
    b = 33;
    continue b;
   }
  default:
   {}
  }
  if ((d[8356] | 0 | 0) <= 1) {
   b = 102;
   break;
  }
  n = 0;
  fa(2, d[8356] | 0 | 0);
  a = n;
  n = 0;
  if ((a | 0) != 0 & (o | 0) != 0) {
   b = Oj(c[a >> 2] | 0, y | 0, z | 0) | 0;
   if (!b) xa(a | 0, o | 0);
   C = o;
  } else b = -1;
  a = C;
  switch (b | 0) {
  case 1:
   {
    b = 61;
    break;
   }
  case 2:
   {
    b = 33;
    break;
   }
  default:
   {
    b = 101;
    break b;
   }
  }
 }
 if ((b | 0) != 101) if ((b | 0) == 102) {
  Cj(y | 0);
  i = A;
  return;
 }
}

function Bj(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0, D = 0;
 do if (a >>> 0 < 245) {
  o = a >>> 0 < 11 ? 16 : a + 11 & -8;
  a = o >>> 3;
  i = c[1965] | 0;
  b = i >>> a;
  if (b & 3) {
   b = (b & 1 ^ 1) + a | 0;
   e = b << 1;
   d = 7900 + (e << 2) | 0;
   e = 7900 + (e + 2 << 2) | 0;
   f = c[e >> 2] | 0;
   g = f + 8 | 0;
   h = c[g >> 2] | 0;
   do if ((d | 0) == (h | 0)) c[1965] = i & ~(1 << b); else {
    if (h >>> 0 < (c[1969] | 0) >>> 0) oa();
    a = h + 12 | 0;
    if ((c[a >> 2] | 0) == (f | 0)) {
     c[a >> 2] = d;
     c[e >> 2] = h;
     break;
    } else oa();
   } while (0);
   D = b << 3;
   c[f + 4 >> 2] = D | 3;
   D = f + (D | 4) | 0;
   c[D >> 2] = c[D >> 2] | 1;
   D = g;
   return D | 0;
  }
  h = c[1967] | 0;
  if (o >>> 0 > h >>> 0) {
   if (b) {
    e = 2 << a;
    e = b << a & (e | 0 - e);
    e = (e & 0 - e) + -1 | 0;
    j = e >>> 12 & 16;
    e = e >>> j;
    f = e >>> 5 & 8;
    e = e >>> f;
    g = e >>> 2 & 4;
    e = e >>> g;
    d = e >>> 1 & 2;
    e = e >>> d;
    b = e >>> 1 & 1;
    b = (f | j | g | d | b) + (e >>> b) | 0;
    e = b << 1;
    d = 7900 + (e << 2) | 0;
    e = 7900 + (e + 2 << 2) | 0;
    g = c[e >> 2] | 0;
    j = g + 8 | 0;
    f = c[j >> 2] | 0;
    do if ((d | 0) == (f | 0)) {
     c[1965] = i & ~(1 << b);
     k = h;
    } else {
     if (f >>> 0 < (c[1969] | 0) >>> 0) oa();
     a = f + 12 | 0;
     if ((c[a >> 2] | 0) == (g | 0)) {
      c[a >> 2] = d;
      c[e >> 2] = f;
      k = c[1967] | 0;
      break;
     } else oa();
    } while (0);
    D = b << 3;
    h = D - o | 0;
    c[g + 4 >> 2] = o | 3;
    i = g + o | 0;
    c[g + (o | 4) >> 2] = h | 1;
    c[g + D >> 2] = h;
    if (k) {
     f = c[1970] | 0;
     d = k >>> 3;
     a = d << 1;
     e = 7900 + (a << 2) | 0;
     b = c[1965] | 0;
     d = 1 << d;
     if (!(b & d)) {
      c[1965] = b | d;
      l = 7900 + (a + 2 << 2) | 0;
      m = e;
     } else {
      b = 7900 + (a + 2 << 2) | 0;
      a = c[b >> 2] | 0;
      if (a >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
       l = b;
       m = a;
      }
     }
     c[l >> 2] = f;
     c[m + 12 >> 2] = f;
     c[f + 8 >> 2] = m;
     c[f + 12 >> 2] = e;
    }
    c[1967] = h;
    c[1970] = i;
    D = j;
    return D | 0;
   }
   a = c[1966] | 0;
   if (a) {
    d = (a & 0 - a) + -1 | 0;
    C = d >>> 12 & 16;
    d = d >>> C;
    B = d >>> 5 & 8;
    d = d >>> B;
    D = d >>> 2 & 4;
    d = d >>> D;
    b = d >>> 1 & 2;
    d = d >>> b;
    e = d >>> 1 & 1;
    e = c[8164 + ((B | C | D | b | e) + (d >>> e) << 2) >> 2] | 0;
    d = (c[e + 4 >> 2] & -8) - o | 0;
    b = e;
    while (1) {
     a = c[b + 16 >> 2] | 0;
     if (!a) {
      a = c[b + 20 >> 2] | 0;
      if (!a) {
       j = d;
       break;
      }
     }
     b = (c[a + 4 >> 2] & -8) - o | 0;
     D = b >>> 0 < d >>> 0;
     d = D ? b : d;
     b = a;
     e = D ? a : e;
    }
    g = c[1969] | 0;
    if (e >>> 0 < g >>> 0) oa();
    i = e + o | 0;
    if (e >>> 0 >= i >>> 0) oa();
    h = c[e + 24 >> 2] | 0;
    d = c[e + 12 >> 2] | 0;
    do if ((d | 0) == (e | 0)) {
     b = e + 20 | 0;
     a = c[b >> 2] | 0;
     if (!a) {
      b = e + 16 | 0;
      a = c[b >> 2] | 0;
      if (!a) {
       n = 0;
       break;
      }
     }
     while (1) {
      d = a + 20 | 0;
      f = c[d >> 2] | 0;
      if (f) {
       a = f;
       b = d;
       continue;
      }
      d = a + 16 | 0;
      f = c[d >> 2] | 0;
      if (!f) break; else {
       a = f;
       b = d;
      }
     }
     if (b >>> 0 < g >>> 0) oa(); else {
      c[b >> 2] = 0;
      n = a;
      break;
     }
    } else {
     f = c[e + 8 >> 2] | 0;
     if (f >>> 0 < g >>> 0) oa();
     a = f + 12 | 0;
     if ((c[a >> 2] | 0) != (e | 0)) oa();
     b = d + 8 | 0;
     if ((c[b >> 2] | 0) == (e | 0)) {
      c[a >> 2] = d;
      c[b >> 2] = f;
      n = d;
      break;
     } else oa();
    } while (0);
    do if (h) {
     a = c[e + 28 >> 2] | 0;
     b = 8164 + (a << 2) | 0;
     if ((e | 0) == (c[b >> 2] | 0)) {
      c[b >> 2] = n;
      if (!n) {
       c[1966] = c[1966] & ~(1 << a);
       break;
      }
     } else {
      if (h >>> 0 < (c[1969] | 0) >>> 0) oa();
      a = h + 16 | 0;
      if ((c[a >> 2] | 0) == (e | 0)) c[a >> 2] = n; else c[h + 20 >> 2] = n;
      if (!n) break;
     }
     b = c[1969] | 0;
     if (n >>> 0 < b >>> 0) oa();
     c[n + 24 >> 2] = h;
     a = c[e + 16 >> 2] | 0;
     do if (a) if (a >>> 0 < b >>> 0) oa(); else {
      c[n + 16 >> 2] = a;
      c[a + 24 >> 2] = n;
      break;
     } while (0);
     a = c[e + 20 >> 2] | 0;
     if (a) if (a >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
      c[n + 20 >> 2] = a;
      c[a + 24 >> 2] = n;
      break;
     }
    } while (0);
    if (j >>> 0 < 16) {
     D = j + o | 0;
     c[e + 4 >> 2] = D | 3;
     D = e + (D + 4) | 0;
     c[D >> 2] = c[D >> 2] | 1;
    } else {
     c[e + 4 >> 2] = o | 3;
     c[e + (o | 4) >> 2] = j | 1;
     c[e + (j + o) >> 2] = j;
     a = c[1967] | 0;
     if (a) {
      g = c[1970] | 0;
      d = a >>> 3;
      a = d << 1;
      f = 7900 + (a << 2) | 0;
      b = c[1965] | 0;
      d = 1 << d;
      if (!(b & d)) {
       c[1965] = b | d;
       p = 7900 + (a + 2 << 2) | 0;
       q = f;
      } else {
       a = 7900 + (a + 2 << 2) | 0;
       b = c[a >> 2] | 0;
       if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
        p = a;
        q = b;
       }
      }
      c[p >> 2] = g;
      c[q + 12 >> 2] = g;
      c[g + 8 >> 2] = q;
      c[g + 12 >> 2] = f;
     }
     c[1967] = j;
     c[1970] = i;
    }
    D = e + 8 | 0;
    return D | 0;
   }
  }
 } else if (a >>> 0 > 4294967231) o = -1; else {
  a = a + 11 | 0;
  o = a & -8;
  j = c[1966] | 0;
  if (j) {
   b = 0 - o | 0;
   a = a >>> 8;
   if (!a) i = 0; else if (o >>> 0 > 16777215) i = 31; else {
    q = (a + 1048320 | 0) >>> 16 & 8;
    v = a << q;
    p = (v + 520192 | 0) >>> 16 & 4;
    v = v << p;
    i = (v + 245760 | 0) >>> 16 & 2;
    i = 14 - (p | q | i) + (v << i >>> 15) | 0;
    i = o >>> (i + 7 | 0) & 1 | i << 1;
   }
   a = c[8164 + (i << 2) >> 2] | 0;
   a : do if (!a) {
    d = 0;
    a = 0;
    v = 86;
   } else {
    f = b;
    d = 0;
    g = o << ((i | 0) == 31 ? 0 : 25 - (i >>> 1) | 0);
    h = a;
    a = 0;
    while (1) {
     e = c[h + 4 >> 2] & -8;
     b = e - o | 0;
     if (b >>> 0 < f >>> 0) if ((e | 0) == (o | 0)) {
      e = h;
      a = h;
      v = 90;
      break a;
     } else a = h; else b = f;
     v = c[h + 20 >> 2] | 0;
     h = c[h + 16 + (g >>> 31 << 2) >> 2] | 0;
     d = (v | 0) == 0 | (v | 0) == (h | 0) ? d : v;
     if (!h) {
      v = 86;
      break;
     } else {
      f = b;
      g = g << 1;
     }
    }
   } while (0);
   if ((v | 0) == 86) {
    if ((d | 0) == 0 & (a | 0) == 0) {
     a = 2 << i;
     a = j & (a | 0 - a);
     if (!a) break;
     a = (a & 0 - a) + -1 | 0;
     n = a >>> 12 & 16;
     a = a >>> n;
     m = a >>> 5 & 8;
     a = a >>> m;
     p = a >>> 2 & 4;
     a = a >>> p;
     q = a >>> 1 & 2;
     a = a >>> q;
     d = a >>> 1 & 1;
     d = c[8164 + ((m | n | p | q | d) + (a >>> d) << 2) >> 2] | 0;
     a = 0;
    }
    if (!d) {
     i = b;
     j = a;
    } else {
     e = d;
     v = 90;
    }
   }
   if ((v | 0) == 90) while (1) {
    v = 0;
    q = (c[e + 4 >> 2] & -8) - o | 0;
    d = q >>> 0 < b >>> 0;
    b = d ? q : b;
    a = d ? e : a;
    d = c[e + 16 >> 2] | 0;
    if (d) {
     e = d;
     v = 90;
     continue;
    }
    e = c[e + 20 >> 2] | 0;
    if (!e) {
     i = b;
     j = a;
     break;
    } else v = 90;
   }
   if (j) if (i >>> 0 < ((c[1967] | 0) - o | 0) >>> 0) {
    f = c[1969] | 0;
    if (j >>> 0 < f >>> 0) oa();
    h = j + o | 0;
    if (j >>> 0 >= h >>> 0) oa();
    g = c[j + 24 >> 2] | 0;
    d = c[j + 12 >> 2] | 0;
    do if ((d | 0) == (j | 0)) {
     b = j + 20 | 0;
     a = c[b >> 2] | 0;
     if (!a) {
      b = j + 16 | 0;
      a = c[b >> 2] | 0;
      if (!a) {
       r = 0;
       break;
      }
     }
     while (1) {
      d = a + 20 | 0;
      e = c[d >> 2] | 0;
      if (e) {
       a = e;
       b = d;
       continue;
      }
      d = a + 16 | 0;
      e = c[d >> 2] | 0;
      if (!e) break; else {
       a = e;
       b = d;
      }
     }
     if (b >>> 0 < f >>> 0) oa(); else {
      c[b >> 2] = 0;
      r = a;
      break;
     }
    } else {
     e = c[j + 8 >> 2] | 0;
     if (e >>> 0 < f >>> 0) oa();
     a = e + 12 | 0;
     if ((c[a >> 2] | 0) != (j | 0)) oa();
     b = d + 8 | 0;
     if ((c[b >> 2] | 0) == (j | 0)) {
      c[a >> 2] = d;
      c[b >> 2] = e;
      r = d;
      break;
     } else oa();
    } while (0);
    do if (g) {
     a = c[j + 28 >> 2] | 0;
     b = 8164 + (a << 2) | 0;
     if ((j | 0) == (c[b >> 2] | 0)) {
      c[b >> 2] = r;
      if (!r) {
       c[1966] = c[1966] & ~(1 << a);
       break;
      }
     } else {
      if (g >>> 0 < (c[1969] | 0) >>> 0) oa();
      a = g + 16 | 0;
      if ((c[a >> 2] | 0) == (j | 0)) c[a >> 2] = r; else c[g + 20 >> 2] = r;
      if (!r) break;
     }
     b = c[1969] | 0;
     if (r >>> 0 < b >>> 0) oa();
     c[r + 24 >> 2] = g;
     a = c[j + 16 >> 2] | 0;
     do if (a) if (a >>> 0 < b >>> 0) oa(); else {
      c[r + 16 >> 2] = a;
      c[a + 24 >> 2] = r;
      break;
     } while (0);
     a = c[j + 20 >> 2] | 0;
     if (a) if (a >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
      c[r + 20 >> 2] = a;
      c[a + 24 >> 2] = r;
      break;
     }
    } while (0);
    b : do if (i >>> 0 < 16) {
     D = i + o | 0;
     c[j + 4 >> 2] = D | 3;
     D = j + (D + 4) | 0;
     c[D >> 2] = c[D >> 2] | 1;
    } else {
     c[j + 4 >> 2] = o | 3;
     c[j + (o | 4) >> 2] = i | 1;
     c[j + (i + o) >> 2] = i;
     a = i >>> 3;
     if (i >>> 0 < 256) {
      b = a << 1;
      e = 7900 + (b << 2) | 0;
      d = c[1965] | 0;
      a = 1 << a;
      if (!(d & a)) {
       c[1965] = d | a;
       s = 7900 + (b + 2 << 2) | 0;
       t = e;
      } else {
       a = 7900 + (b + 2 << 2) | 0;
       b = c[a >> 2] | 0;
       if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
        s = a;
        t = b;
       }
      }
      c[s >> 2] = h;
      c[t + 12 >> 2] = h;
      c[j + (o + 8) >> 2] = t;
      c[j + (o + 12) >> 2] = e;
      break;
     }
     a = i >>> 8;
     if (!a) e = 0; else if (i >>> 0 > 16777215) e = 31; else {
      C = (a + 1048320 | 0) >>> 16 & 8;
      D = a << C;
      B = (D + 520192 | 0) >>> 16 & 4;
      D = D << B;
      e = (D + 245760 | 0) >>> 16 & 2;
      e = 14 - (B | C | e) + (D << e >>> 15) | 0;
      e = i >>> (e + 7 | 0) & 1 | e << 1;
     }
     a = 8164 + (e << 2) | 0;
     c[j + (o + 28) >> 2] = e;
     c[j + (o + 20) >> 2] = 0;
     c[j + (o + 16) >> 2] = 0;
     b = c[1966] | 0;
     d = 1 << e;
     if (!(b & d)) {
      c[1966] = b | d;
      c[a >> 2] = h;
      c[j + (o + 24) >> 2] = a;
      c[j + (o + 12) >> 2] = h;
      c[j + (o + 8) >> 2] = h;
      break;
     }
     a = c[a >> 2] | 0;
     c : do if ((c[a + 4 >> 2] & -8 | 0) == (i | 0)) u = a; else {
      e = i << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
      while (1) {
       b = a + 16 + (e >>> 31 << 2) | 0;
       d = c[b >> 2] | 0;
       if (!d) break;
       if ((c[d + 4 >> 2] & -8 | 0) == (i | 0)) {
        u = d;
        break c;
       } else {
        e = e << 1;
        a = d;
       }
      }
      if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
       c[b >> 2] = h;
       c[j + (o + 24) >> 2] = a;
       c[j + (o + 12) >> 2] = h;
       c[j + (o + 8) >> 2] = h;
       break b;
      }
     } while (0);
     a = u + 8 | 0;
     b = c[a >> 2] | 0;
     D = c[1969] | 0;
     if (b >>> 0 >= D >>> 0 & u >>> 0 >= D >>> 0) {
      c[b + 12 >> 2] = h;
      c[a >> 2] = h;
      c[j + (o + 8) >> 2] = b;
      c[j + (o + 12) >> 2] = u;
      c[j + (o + 24) >> 2] = 0;
      break;
     } else oa();
    } while (0);
    D = j + 8 | 0;
    return D | 0;
   }
  }
 } while (0);
 d = c[1967] | 0;
 if (d >>> 0 >= o >>> 0) {
  a = d - o | 0;
  b = c[1970] | 0;
  if (a >>> 0 > 15) {
   c[1970] = b + o;
   c[1967] = a;
   c[b + (o + 4) >> 2] = a | 1;
   c[b + d >> 2] = a;
   c[b + 4 >> 2] = o | 3;
  } else {
   c[1967] = 0;
   c[1970] = 0;
   c[b + 4 >> 2] = d | 3;
   D = b + (d + 4) | 0;
   c[D >> 2] = c[D >> 2] | 1;
  }
  D = b + 8 | 0;
  return D | 0;
 }
 a = c[1968] | 0;
 if (a >>> 0 > o >>> 0) {
  C = a - o | 0;
  c[1968] = C;
  D = c[1971] | 0;
  c[1971] = D + o;
  c[D + (o + 4) >> 2] = C | 1;
  c[D + 4 >> 2] = o | 3;
  D = D + 8 | 0;
  return D | 0;
 }
 do if (!(c[2083] | 0)) {
  a = Fa(30) | 0;
  if (!(a + -1 & a)) {
   c[2085] = a;
   c[2084] = a;
   c[2086] = -1;
   c[2087] = -1;
   c[2088] = 0;
   c[2076] = 0;
   c[2083] = (Xa(0) | 0) & -16 ^ 1431655768;
   break;
  } else oa();
 } while (0);
 h = o + 48 | 0;
 g = c[2085] | 0;
 i = o + 47 | 0;
 f = g + i | 0;
 g = 0 - g | 0;
 j = f & g;
 if (j >>> 0 <= o >>> 0) {
  D = 0;
  return D | 0;
 }
 a = c[2075] | 0;
 if (a) {
  t = c[2073] | 0;
  u = t + j | 0;
  if (u >>> 0 <= t >>> 0 | u >>> 0 > a >>> 0) {
   D = 0;
   return D | 0;
  }
 }
 d : do if (!(c[2076] & 4)) {
  b = c[1971] | 0;
  e : do if (!b) v = 174; else {
   e = 8308;
   while (1) {
    d = c[e >> 2] | 0;
    if (d >>> 0 <= b >>> 0) {
     a = e + 4 | 0;
     if ((d + (c[a >> 2] | 0) | 0) >>> 0 > b >>> 0) break;
    }
    e = c[e + 8 >> 2] | 0;
    if (!e) {
     v = 174;
     break e;
    }
   }
   b = f - (c[1968] | 0) & g;
   if (b >>> 0 < 2147483647) {
    d = Ca(b | 0) | 0;
    u = (d | 0) == ((c[e >> 2] | 0) + (c[a >> 2] | 0) | 0);
    a = u ? b : 0;
    if (u) {
     if ((d | 0) != (-1 | 0)) {
      r = d;
      q = a;
      v = 194;
      break d;
     }
    } else {
     f = d;
     v = 184;
    }
   } else a = 0;
  } while (0);
  do if ((v | 0) == 174) {
   f = Ca(0) | 0;
   if ((f | 0) == (-1 | 0)) a = 0; else {
    a = f;
    b = c[2084] | 0;
    d = b + -1 | 0;
    if (!(d & a)) b = j; else b = j - a + (d + a & 0 - b) | 0;
    a = c[2073] | 0;
    d = a + b | 0;
    if (b >>> 0 > o >>> 0 & b >>> 0 < 2147483647) {
     e = c[2075] | 0;
     if (e) if (d >>> 0 <= a >>> 0 | d >>> 0 > e >>> 0) {
      a = 0;
      break;
     }
     d = Ca(b | 0) | 0;
     v = (d | 0) == (f | 0);
     a = v ? b : 0;
     if (v) {
      r = f;
      q = a;
      v = 194;
      break d;
     } else {
      f = d;
      v = 184;
     }
    } else a = 0;
   }
  } while (0);
  f : do if ((v | 0) == 184) {
   e = 0 - b | 0;
   do if (h >>> 0 > b >>> 0 & (b >>> 0 < 2147483647 & (f | 0) != (-1 | 0))) {
    d = c[2085] | 0;
    d = i - b + d & 0 - d;
    if (d >>> 0 < 2147483647) if ((Ca(d | 0) | 0) == (-1 | 0)) {
     Ca(e | 0) | 0;
     break f;
    } else {
     b = d + b | 0;
     break;
    }
   } while (0);
   if ((f | 0) != (-1 | 0)) {
    r = f;
    q = b;
    v = 194;
    break d;
   }
  } while (0);
  c[2076] = c[2076] | 4;
  v = 191;
 } else {
  a = 0;
  v = 191;
 } while (0);
 if ((v | 0) == 191) if (j >>> 0 < 2147483647) {
  d = Ca(j | 0) | 0;
  b = Ca(0) | 0;
  if (d >>> 0 < b >>> 0 & ((d | 0) != (-1 | 0) & (b | 0) != (-1 | 0))) {
   b = b - d | 0;
   e = b >>> 0 > (o + 40 | 0) >>> 0;
   if (e) {
    r = d;
    q = e ? b : a;
    v = 194;
   }
  }
 }
 if ((v | 0) == 194) {
  a = (c[2073] | 0) + q | 0;
  c[2073] = a;
  if (a >>> 0 > (c[2074] | 0) >>> 0) c[2074] = a;
  h = c[1971] | 0;
  g : do if (!h) {
   D = c[1969] | 0;
   if ((D | 0) == 0 | r >>> 0 < D >>> 0) c[1969] = r;
   c[2077] = r;
   c[2078] = q;
   c[2080] = 0;
   c[1974] = c[2083];
   c[1973] = -1;
   a = 0;
   do {
    D = a << 1;
    C = 7900 + (D << 2) | 0;
    c[7900 + (D + 3 << 2) >> 2] = C;
    c[7900 + (D + 2 << 2) >> 2] = C;
    a = a + 1 | 0;
   } while ((a | 0) != 32);
   D = r + 8 | 0;
   D = (D & 7 | 0) == 0 ? 0 : 0 - D & 7;
   C = q + -40 - D | 0;
   c[1971] = r + D;
   c[1968] = C;
   c[r + (D + 4) >> 2] = C | 1;
   c[r + (q + -36) >> 2] = 40;
   c[1972] = c[2087];
  } else {
   b = 8308;
   do {
    a = c[b >> 2] | 0;
    e = b + 4 | 0;
    d = c[e >> 2] | 0;
    if ((r | 0) == (a + d | 0)) {
     v = 204;
     break;
    }
    b = c[b + 8 >> 2] | 0;
   } while ((b | 0) != 0);
   if ((v | 0) == 204) if (!(c[b + 12 >> 2] & 8)) if (h >>> 0 < r >>> 0 & h >>> 0 >= a >>> 0) {
    c[e >> 2] = d + q;
    D = (c[1968] | 0) + q | 0;
    C = h + 8 | 0;
    C = (C & 7 | 0) == 0 ? 0 : 0 - C & 7;
    B = D - C | 0;
    c[1971] = h + C;
    c[1968] = B;
    c[h + (C + 4) >> 2] = B | 1;
    c[h + (D + 4) >> 2] = 40;
    c[1972] = c[2087];
    break;
   }
   a = c[1969] | 0;
   if (r >>> 0 < a >>> 0) {
    c[1969] = r;
    i = r;
   } else i = a;
   a = r + q | 0;
   d = 8308;
   while (1) {
    if ((c[d >> 2] | 0) == (a | 0)) {
     b = d;
     a = d;
     v = 212;
     break;
    }
    d = c[d + 8 >> 2] | 0;
    if (!d) {
     d = 8308;
     break;
    }
   }
   if ((v | 0) == 212) if (!(c[a + 12 >> 2] & 8)) {
    c[b >> 2] = r;
    n = a + 4 | 0;
    c[n >> 2] = (c[n >> 2] | 0) + q;
    n = r + 8 | 0;
    n = (n & 7 | 0) == 0 ? 0 : 0 - n & 7;
    k = r + (q + 8) | 0;
    k = (k & 7 | 0) == 0 ? 0 : 0 - k & 7;
    a = r + (k + q) | 0;
    m = n + o | 0;
    p = r + m | 0;
    l = a - (r + n) - o | 0;
    c[r + (n + 4) >> 2] = o | 3;
    h : do if ((a | 0) == (h | 0)) {
     D = (c[1968] | 0) + l | 0;
     c[1968] = D;
     c[1971] = p;
     c[r + (m + 4) >> 2] = D | 1;
    } else {
     if ((a | 0) == (c[1970] | 0)) {
      D = (c[1967] | 0) + l | 0;
      c[1967] = D;
      c[1970] = p;
      c[r + (m + 4) >> 2] = D | 1;
      c[r + (D + m) >> 2] = D;
      break;
     }
     h = q + 4 | 0;
     b = c[r + (h + k) >> 2] | 0;
     if ((b & 3 | 0) == 1) {
      j = b & -8;
      f = b >>> 3;
      i : do if (b >>> 0 < 256) {
       d = c[r + ((k | 8) + q) >> 2] | 0;
       e = c[r + (q + 12 + k) >> 2] | 0;
       b = 7900 + (f << 1 << 2) | 0;
       do if ((d | 0) != (b | 0)) {
        if (d >>> 0 < i >>> 0) oa();
        if ((c[d + 12 >> 2] | 0) == (a | 0)) break;
        oa();
       } while (0);
       if ((e | 0) == (d | 0)) {
        c[1965] = c[1965] & ~(1 << f);
        break;
       }
       do if ((e | 0) == (b | 0)) w = e + 8 | 0; else {
        if (e >>> 0 < i >>> 0) oa();
        b = e + 8 | 0;
        if ((c[b >> 2] | 0) == (a | 0)) {
         w = b;
         break;
        }
        oa();
       } while (0);
       c[d + 12 >> 2] = e;
       c[w >> 2] = d;
      } else {
       g = c[r + ((k | 24) + q) >> 2] | 0;
       e = c[r + (q + 12 + k) >> 2] | 0;
       do if ((e | 0) == (a | 0)) {
        e = k | 16;
        d = r + (h + e) | 0;
        b = c[d >> 2] | 0;
        if (!b) {
         d = r + (e + q) | 0;
         b = c[d >> 2] | 0;
         if (!b) {
          A = 0;
          break;
         }
        }
        while (1) {
         e = b + 20 | 0;
         f = c[e >> 2] | 0;
         if (f) {
          b = f;
          d = e;
          continue;
         }
         e = b + 16 | 0;
         f = c[e >> 2] | 0;
         if (!f) break; else {
          b = f;
          d = e;
         }
        }
        if (d >>> 0 < i >>> 0) oa(); else {
         c[d >> 2] = 0;
         A = b;
         break;
        }
       } else {
        f = c[r + ((k | 8) + q) >> 2] | 0;
        if (f >>> 0 < i >>> 0) oa();
        b = f + 12 | 0;
        if ((c[b >> 2] | 0) != (a | 0)) oa();
        d = e + 8 | 0;
        if ((c[d >> 2] | 0) == (a | 0)) {
         c[b >> 2] = e;
         c[d >> 2] = f;
         A = e;
         break;
        } else oa();
       } while (0);
       if (!g) break;
       b = c[r + (q + 28 + k) >> 2] | 0;
       d = 8164 + (b << 2) | 0;
       do if ((a | 0) == (c[d >> 2] | 0)) {
        c[d >> 2] = A;
        if (A) break;
        c[1966] = c[1966] & ~(1 << b);
        break i;
       } else {
        if (g >>> 0 < (c[1969] | 0) >>> 0) oa();
        b = g + 16 | 0;
        if ((c[b >> 2] | 0) == (a | 0)) c[b >> 2] = A; else c[g + 20 >> 2] = A;
        if (!A) break i;
       } while (0);
       d = c[1969] | 0;
       if (A >>> 0 < d >>> 0) oa();
       c[A + 24 >> 2] = g;
       a = k | 16;
       b = c[r + (a + q) >> 2] | 0;
       do if (b) if (b >>> 0 < d >>> 0) oa(); else {
        c[A + 16 >> 2] = b;
        c[b + 24 >> 2] = A;
        break;
       } while (0);
       a = c[r + (h + a) >> 2] | 0;
       if (!a) break;
       if (a >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
        c[A + 20 >> 2] = a;
        c[a + 24 >> 2] = A;
        break;
       }
      } while (0);
      a = r + ((j | k) + q) | 0;
      f = j + l | 0;
     } else f = l;
     a = a + 4 | 0;
     c[a >> 2] = c[a >> 2] & -2;
     c[r + (m + 4) >> 2] = f | 1;
     c[r + (f + m) >> 2] = f;
     a = f >>> 3;
     if (f >>> 0 < 256) {
      b = a << 1;
      e = 7900 + (b << 2) | 0;
      d = c[1965] | 0;
      a = 1 << a;
      do if (!(d & a)) {
       c[1965] = d | a;
       B = 7900 + (b + 2 << 2) | 0;
       C = e;
      } else {
       a = 7900 + (b + 2 << 2) | 0;
       b = c[a >> 2] | 0;
       if (b >>> 0 >= (c[1969] | 0) >>> 0) {
        B = a;
        C = b;
        break;
       }
       oa();
      } while (0);
      c[B >> 2] = p;
      c[C + 12 >> 2] = p;
      c[r + (m + 8) >> 2] = C;
      c[r + (m + 12) >> 2] = e;
      break;
     }
     a = f >>> 8;
     do if (!a) e = 0; else {
      if (f >>> 0 > 16777215) {
       e = 31;
       break;
      }
      B = (a + 1048320 | 0) >>> 16 & 8;
      C = a << B;
      A = (C + 520192 | 0) >>> 16 & 4;
      C = C << A;
      e = (C + 245760 | 0) >>> 16 & 2;
      e = 14 - (A | B | e) + (C << e >>> 15) | 0;
      e = f >>> (e + 7 | 0) & 1 | e << 1;
     } while (0);
     a = 8164 + (e << 2) | 0;
     c[r + (m + 28) >> 2] = e;
     c[r + (m + 20) >> 2] = 0;
     c[r + (m + 16) >> 2] = 0;
     b = c[1966] | 0;
     d = 1 << e;
     if (!(b & d)) {
      c[1966] = b | d;
      c[a >> 2] = p;
      c[r + (m + 24) >> 2] = a;
      c[r + (m + 12) >> 2] = p;
      c[r + (m + 8) >> 2] = p;
      break;
     }
     a = c[a >> 2] | 0;
     j : do if ((c[a + 4 >> 2] & -8 | 0) == (f | 0)) D = a; else {
      e = f << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
      while (1) {
       b = a + 16 + (e >>> 31 << 2) | 0;
       d = c[b >> 2] | 0;
       if (!d) break;
       if ((c[d + 4 >> 2] & -8 | 0) == (f | 0)) {
        D = d;
        break j;
       } else {
        e = e << 1;
        a = d;
       }
      }
      if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
       c[b >> 2] = p;
       c[r + (m + 24) >> 2] = a;
       c[r + (m + 12) >> 2] = p;
       c[r + (m + 8) >> 2] = p;
       break h;
      }
     } while (0);
     a = D + 8 | 0;
     b = c[a >> 2] | 0;
     C = c[1969] | 0;
     if (b >>> 0 >= C >>> 0 & D >>> 0 >= C >>> 0) {
      c[b + 12 >> 2] = p;
      c[a >> 2] = p;
      c[r + (m + 8) >> 2] = b;
      c[r + (m + 12) >> 2] = D;
      c[r + (m + 24) >> 2] = 0;
      break;
     } else oa();
    } while (0);
    D = r + (n | 8) | 0;
    return D | 0;
   } else d = 8308;
   while (1) {
    b = c[d >> 2] | 0;
    if (b >>> 0 <= h >>> 0) {
     a = c[d + 4 >> 2] | 0;
     e = b + a | 0;
     if (e >>> 0 > h >>> 0) break;
    }
    d = c[d + 8 >> 2] | 0;
   }
   f = b + (a + -39) | 0;
   b = b + (a + -47 + ((f & 7 | 0) == 0 ? 0 : 0 - f & 7)) | 0;
   f = h + 16 | 0;
   b = b >>> 0 < f >>> 0 ? h : b;
   a = b + 8 | 0;
   d = r + 8 | 0;
   d = (d & 7 | 0) == 0 ? 0 : 0 - d & 7;
   D = q + -40 - d | 0;
   c[1971] = r + d;
   c[1968] = D;
   c[r + (d + 4) >> 2] = D | 1;
   c[r + (q + -36) >> 2] = 40;
   c[1972] = c[2087];
   d = b + 4 | 0;
   c[d >> 2] = 27;
   c[a >> 2] = c[2077];
   c[a + 4 >> 2] = c[2078];
   c[a + 8 >> 2] = c[2079];
   c[a + 12 >> 2] = c[2080];
   c[2077] = r;
   c[2078] = q;
   c[2080] = 0;
   c[2079] = a;
   a = b + 28 | 0;
   c[a >> 2] = 7;
   if ((b + 32 | 0) >>> 0 < e >>> 0) do {
    D = a;
    a = a + 4 | 0;
    c[a >> 2] = 7;
   } while ((D + 8 | 0) >>> 0 < e >>> 0);
   if ((b | 0) != (h | 0)) {
    g = b - h | 0;
    c[d >> 2] = c[d >> 2] & -2;
    c[h + 4 >> 2] = g | 1;
    c[b >> 2] = g;
    a = g >>> 3;
    if (g >>> 0 < 256) {
     b = a << 1;
     e = 7900 + (b << 2) | 0;
     d = c[1965] | 0;
     a = 1 << a;
     if (!(d & a)) {
      c[1965] = d | a;
      x = 7900 + (b + 2 << 2) | 0;
      y = e;
     } else {
      a = 7900 + (b + 2 << 2) | 0;
      b = c[a >> 2] | 0;
      if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
       x = a;
       y = b;
      }
     }
     c[x >> 2] = h;
     c[y + 12 >> 2] = h;
     c[h + 8 >> 2] = y;
     c[h + 12 >> 2] = e;
     break;
    }
    a = g >>> 8;
    if (!a) e = 0; else if (g >>> 0 > 16777215) e = 31; else {
     C = (a + 1048320 | 0) >>> 16 & 8;
     D = a << C;
     B = (D + 520192 | 0) >>> 16 & 4;
     D = D << B;
     e = (D + 245760 | 0) >>> 16 & 2;
     e = 14 - (B | C | e) + (D << e >>> 15) | 0;
     e = g >>> (e + 7 | 0) & 1 | e << 1;
    }
    d = 8164 + (e << 2) | 0;
    c[h + 28 >> 2] = e;
    c[h + 20 >> 2] = 0;
    c[f >> 2] = 0;
    a = c[1966] | 0;
    b = 1 << e;
    if (!(a & b)) {
     c[1966] = a | b;
     c[d >> 2] = h;
     c[h + 24 >> 2] = d;
     c[h + 12 >> 2] = h;
     c[h + 8 >> 2] = h;
     break;
    }
    a = c[d >> 2] | 0;
    k : do if ((c[a + 4 >> 2] & -8 | 0) == (g | 0)) z = a; else {
     e = g << ((e | 0) == 31 ? 0 : 25 - (e >>> 1) | 0);
     while (1) {
      b = a + 16 + (e >>> 31 << 2) | 0;
      d = c[b >> 2] | 0;
      if (!d) break;
      if ((c[d + 4 >> 2] & -8 | 0) == (g | 0)) {
       z = d;
       break k;
      } else {
       e = e << 1;
       a = d;
      }
     }
     if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
      c[b >> 2] = h;
      c[h + 24 >> 2] = a;
      c[h + 12 >> 2] = h;
      c[h + 8 >> 2] = h;
      break g;
     }
    } while (0);
    a = z + 8 | 0;
    b = c[a >> 2] | 0;
    D = c[1969] | 0;
    if (b >>> 0 >= D >>> 0 & z >>> 0 >= D >>> 0) {
     c[b + 12 >> 2] = h;
     c[a >> 2] = h;
     c[h + 8 >> 2] = b;
     c[h + 12 >> 2] = z;
     c[h + 24 >> 2] = 0;
     break;
    } else oa();
   }
  } while (0);
  a = c[1968] | 0;
  if (a >>> 0 > o >>> 0) {
   C = a - o | 0;
   c[1968] = C;
   D = c[1971] | 0;
   c[1971] = D + o;
   c[D + (o + 4) >> 2] = C | 1;
   c[D + 4 >> 2] = o | 3;
   D = D + 8 | 0;
   return D | 0;
  }
 }
 c[(Hi() | 0) >> 2] = 12;
 D = 0;
 return D | 0;
}

function wj(e, f, g, j, l) {
 e = e | 0;
 f = f | 0;
 g = g | 0;
 j = j | 0;
 l = l | 0;
 var m = 0, n = 0, o = 0, p = 0, q = 0.0, r = 0, s = 0, t = 0, u = 0, v = 0.0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, D = 0, E = 0, F = 0, G = 0, H = 0, I = 0, J = 0, K = 0, L = 0, M = 0, N = 0, O = 0, P = 0, Q = 0, R = 0, S = 0, T = 0, U = 0, V = 0, W = 0, X = 0, Y = 0, Z = 0, $ = 0, aa = 0, ba = 0, ca = 0, da = 0, ea = 0, fa = 0, ga = 0, ha = 0;
 ha = i;
 i = i + 624 | 0;
 ca = ha + 24 | 0;
 ea = ha + 16 | 0;
 da = ha + 588 | 0;
 Y = ha + 576 | 0;
 ba = ha;
 V = ha + 536 | 0;
 ga = ha + 8 | 0;
 fa = ha + 528 | 0;
 M = (e | 0) != 0;
 N = V + 40 | 0;
 U = N;
 V = V + 39 | 0;
 W = ga + 4 | 0;
 X = Y + 12 | 0;
 Y = Y + 11 | 0;
 Z = da;
 $ = X;
 aa = $ - Z | 0;
 O = -2 - Z | 0;
 P = $ + 2 | 0;
 Q = ca + 288 | 0;
 R = da + 9 | 0;
 S = R;
 T = da + 8 | 0;
 w = f;
 f = 0;
 n = 0;
 m = 0;
 a : while (1) {
  do if ((f | 0) > -1) if ((n | 0) > (2147483647 - f | 0)) {
   c[(Hi() | 0) >> 2] = 75;
   f = -1;
   break;
  } else {
   f = n + f | 0;
   break;
  } while (0);
  n = a[w >> 0] | 0;
  if (!(n << 24 >> 24)) {
   L = 245;
   break;
  } else o = w;
  b : while (1) {
   switch (n << 24 >> 24) {
   case 37:
    {
     n = o;
     L = 9;
     break b;
    }
   case 0:
    {
     n = o;
     break b;
    }
   default:
    {}
   }
   K = o + 1 | 0;
   n = a[K >> 0] | 0;
   o = K;
  }
  c : do if ((L | 0) == 9) while (1) {
   L = 0;
   if ((a[n + 1 >> 0] | 0) != 37) break c;
   o = o + 1 | 0;
   n = n + 2 | 0;
   if ((a[n >> 0] | 0) == 37) L = 9; else break;
  } while (0);
  y = o - w | 0;
  if (M) if (!(c[e >> 2] & 32)) Ii(w, y, e) | 0;
  if ((o | 0) != (w | 0)) {
   w = n;
   n = y;
   continue;
  }
  r = n + 1 | 0;
  o = a[r >> 0] | 0;
  p = (o << 24 >> 24) + -48 | 0;
  if (p >>> 0 < 10) {
   K = (a[n + 2 >> 0] | 0) == 36;
   n = K ? n + 3 | 0 : r;
   o = a[n >> 0] | 0;
   u = K ? p : -1;
   m = K ? 1 : m;
  } else {
   u = -1;
   n = r;
  }
  p = o << 24 >> 24;
  d : do if ((p & -32 | 0) == 32) {
   r = 0;
   do {
    if (!(1 << p + -32 & 75913)) break d;
    r = 1 << (o << 24 >> 24) + -32 | r;
    n = n + 1 | 0;
    o = a[n >> 0] | 0;
    p = o << 24 >> 24;
   } while ((p & -32 | 0) == 32);
  } else r = 0; while (0);
  do if (o << 24 >> 24 == 42) {
   p = n + 1 | 0;
   o = (a[p >> 0] | 0) + -48 | 0;
   if (o >>> 0 < 10) if ((a[n + 2 >> 0] | 0) == 36) {
    c[l + (o << 2) >> 2] = 10;
    m = 1;
    n = n + 3 | 0;
    o = c[j + ((a[p >> 0] | 0) + -48 << 3) >> 2] | 0;
   } else L = 24; else L = 24;
   if ((L | 0) == 24) {
    L = 0;
    if (m) {
     f = -1;
     break a;
    }
    if (!M) {
     n = p;
     x = r;
     m = 0;
     K = 0;
     break;
    }
    m = (c[g >> 2] | 0) + (4 - 1) & ~(4 - 1);
    o = c[m >> 2] | 0;
    c[g >> 2] = m + 4;
    m = 0;
    n = p;
   }
   if ((o | 0) < 0) {
    x = r | 8192;
    K = 0 - o | 0;
   } else {
    x = r;
    K = o;
   }
  } else {
   p = (o << 24 >> 24) + -48 | 0;
   if (p >>> 0 < 10) {
    o = 0;
    do {
     o = (o * 10 | 0) + p | 0;
     n = n + 1 | 0;
     p = (a[n >> 0] | 0) + -48 | 0;
    } while (p >>> 0 < 10);
    if ((o | 0) < 0) {
     f = -1;
     break a;
    } else {
     x = r;
     K = o;
    }
   } else {
    x = r;
    K = 0;
   }
  } while (0);
  e : do if ((a[n >> 0] | 0) == 46) {
   p = n + 1 | 0;
   o = a[p >> 0] | 0;
   if (o << 24 >> 24 != 42) {
    r = (o << 24 >> 24) + -48 | 0;
    if (r >>> 0 < 10) {
     n = p;
     o = 0;
    } else {
     n = p;
     r = 0;
     break;
    }
    while (1) {
     o = (o * 10 | 0) + r | 0;
     n = n + 1 | 0;
     r = (a[n >> 0] | 0) + -48 | 0;
     if (r >>> 0 >= 10) {
      r = o;
      break e;
     }
    }
   }
   p = n + 2 | 0;
   o = (a[p >> 0] | 0) + -48 | 0;
   if (o >>> 0 < 10) if ((a[n + 3 >> 0] | 0) == 36) {
    c[l + (o << 2) >> 2] = 10;
    n = n + 4 | 0;
    r = c[j + ((a[p >> 0] | 0) + -48 << 3) >> 2] | 0;
    break;
   }
   if (m) {
    f = -1;
    break a;
   }
   if (M) {
    n = (c[g >> 2] | 0) + (4 - 1) & ~(4 - 1);
    r = c[n >> 2] | 0;
    c[g >> 2] = n + 4;
    n = p;
   } else {
    n = p;
    r = 0;
   }
  } else r = -1; while (0);
  t = 0;
  while (1) {
   o = (a[n >> 0] | 0) + -65 | 0;
   if (o >>> 0 > 57) {
    f = -1;
    break a;
   }
   s = n + 1 | 0;
   o = a[33517 + (t * 58 | 0) + o >> 0] | 0;
   p = o & 255;
   if ((p + -1 | 0) >>> 0 < 8) {
    n = s;
    t = p;
   } else {
    J = s;
    s = o;
    break;
   }
  }
  if (!(s << 24 >> 24)) {
   f = -1;
   break;
  }
  o = (u | 0) > -1;
  do if (s << 24 >> 24 == 19) if (o) {
   f = -1;
   break a;
  } else L = 52; else {
   if (o) {
    c[l + (u << 2) >> 2] = p;
    H = j + (u << 3) | 0;
    I = c[H + 4 >> 2] | 0;
    L = ba;
    c[L >> 2] = c[H >> 2];
    c[L + 4 >> 2] = I;
    L = 52;
    break;
   }
   if (!M) {
    f = 0;
    break a;
   }
   xj(ba, p, g);
  } while (0);
  if ((L | 0) == 52) {
   L = 0;
   if (!M) {
    w = J;
    n = y;
    continue;
   }
  }
  u = a[n >> 0] | 0;
  u = (t | 0) != 0 & (u & 15 | 0) == 3 ? u & -33 : u;
  p = x & -65537;
  I = (x & 8192 | 0) == 0 ? x : p;
  f : do switch (u | 0) {
  case 110:
   switch (t | 0) {
   case 0:
    {
     c[c[ba >> 2] >> 2] = f;
     w = J;
     n = y;
     continue a;
    }
   case 1:
    {
     c[c[ba >> 2] >> 2] = f;
     w = J;
     n = y;
     continue a;
    }
   case 2:
    {
     w = c[ba >> 2] | 0;
     c[w >> 2] = f;
     c[w + 4 >> 2] = ((f | 0) < 0) << 31 >> 31;
     w = J;
     n = y;
     continue a;
    }
   case 3:
    {
     b[c[ba >> 2] >> 1] = f;
     w = J;
     n = y;
     continue a;
    }
   case 4:
    {
     a[c[ba >> 2] >> 0] = f;
     w = J;
     n = y;
     continue a;
    }
   case 6:
    {
     c[c[ba >> 2] >> 2] = f;
     w = J;
     n = y;
     continue a;
    }
   case 7:
    {
     w = c[ba >> 2] | 0;
     c[w >> 2] = f;
     c[w + 4 >> 2] = ((f | 0) < 0) << 31 >> 31;
     w = J;
     n = y;
     continue a;
    }
   default:
    {
     w = J;
     n = y;
     continue a;
    }
   }
  case 112:
   {
    t = I | 8;
    r = r >>> 0 > 8 ? r : 8;
    u = 120;
    L = 64;
    break;
   }
  case 88:
  case 120:
   {
    t = I;
    L = 64;
    break;
   }
  case 111:
   {
    p = ba;
    o = c[p >> 2] | 0;
    p = c[p + 4 >> 2] | 0;
    if ((o | 0) == 0 & (p | 0) == 0) n = N; else {
     n = N;
     do {
      n = n + -1 | 0;
      a[n >> 0] = o & 7 | 48;
      o = Nj(o | 0, p | 0, 3) | 0;
      p = C;
     } while (!((o | 0) == 0 & (p | 0) == 0));
    }
    if (!(I & 8)) {
     o = I;
     t = 0;
     s = 33997;
     L = 77;
    } else {
     t = U - n + 1 | 0;
     o = I;
     r = (r | 0) < (t | 0) ? t : r;
     t = 0;
     s = 33997;
     L = 77;
    }
    break;
   }
  case 105:
  case 100:
   {
    o = ba;
    n = c[o >> 2] | 0;
    o = c[o + 4 >> 2] | 0;
    if ((o | 0) < 0) {
     n = Ij(0, 0, n | 0, o | 0) | 0;
     o = C;
     p = ba;
     c[p >> 2] = n;
     c[p + 4 >> 2] = o;
     p = 1;
     s = 33997;
     L = 76;
     break f;
    }
    if (!(I & 2048)) {
     s = I & 1;
     p = s;
     s = (s | 0) == 0 ? 33997 : 33999;
     L = 76;
    } else {
     p = 1;
     s = 33998;
     L = 76;
    }
    break;
   }
  case 117:
   {
    o = ba;
    n = c[o >> 2] | 0;
    o = c[o + 4 >> 2] | 0;
    p = 0;
    s = 33997;
    L = 76;
    break;
   }
  case 99:
   {
    a[V >> 0] = c[ba >> 2];
    w = V;
    o = 1;
    t = 0;
    u = 33997;
    n = N;
    break;
   }
  case 109:
   {
    n = Gi(c[(Hi() | 0) >> 2] | 0) | 0;
    L = 82;
    break;
   }
  case 115:
   {
    n = c[ba >> 2] | 0;
    n = (n | 0) != 0 ? n : 34007;
    L = 82;
    break;
   }
  case 67:
   {
    c[ga >> 2] = c[ba >> 2];
    c[W >> 2] = 0;
    c[ba >> 2] = ga;
    r = -1;
    L = 86;
    break;
   }
  case 83:
   {
    if (!r) {
     zj(e, 32, K, 0, I);
     n = 0;
     L = 98;
    } else L = 86;
    break;
   }
  case 65:
  case 71:
  case 70:
  case 69:
  case 97:
  case 103:
  case 102:
  case 101:
   {
    q = +h[ba >> 3];
    c[ea >> 2] = 0;
    h[k >> 3] = q;
    if ((c[k + 4 >> 2] | 0) < 0) {
     q = -q;
     G = 1;
     H = 34014;
    } else if (!(I & 2048)) {
     H = I & 1;
     G = H;
     H = (H | 0) == 0 ? 34015 : 34020;
    } else {
     G = 1;
     H = 34017;
    }
    h[k >> 3] = q;
    F = c[k + 4 >> 2] & 2146435072;
    do if (F >>> 0 < 2146435072 | (F | 0) == 2146435072 & 0 < 0) {
     v = +Lh(q, ea) * 2.0;
     o = v != 0.0;
     if (o) c[ea >> 2] = (c[ea >> 2] | 0) + -1;
     D = u | 32;
     if ((D | 0) == 97) {
      w = u & 32;
      y = (w | 0) == 0 ? H : H + 9 | 0;
      x = G | 2;
      n = 12 - r | 0;
      do if (r >>> 0 > 11 | (n | 0) == 0) q = v; else {
       q = 8.0;
       do {
        n = n + -1 | 0;
        q = q * 16.0;
       } while ((n | 0) != 0);
       if ((a[y >> 0] | 0) == 45) {
        q = -(q + (-v - q));
        break;
       } else {
        q = v + q - q;
        break;
       }
      } while (0);
      o = c[ea >> 2] | 0;
      n = (o | 0) < 0 ? 0 - o | 0 : o;
      n = yj(n, ((n | 0) < 0) << 31 >> 31, X) | 0;
      if ((n | 0) == (X | 0)) {
       a[Y >> 0] = 48;
       n = Y;
      }
      a[n + -1 >> 0] = (o >> 31 & 2) + 43;
      t = n + -2 | 0;
      a[t >> 0] = u + 15;
      s = (r | 0) < 1;
      p = (I & 8 | 0) == 0;
      o = da;
      while (1) {
       H = ~~q;
       n = o + 1 | 0;
       a[o >> 0] = d[33981 + H >> 0] | w;
       q = (q - +(H | 0)) * 16.0;
       do if ((n - Z | 0) == 1) {
        if (p & (s & q == 0.0)) break;
        a[n >> 0] = 46;
        n = o + 2 | 0;
       } while (0);
       if (!(q != 0.0)) break; else o = n;
      }
      r = (r | 0) != 0 & (O + n | 0) < (r | 0) ? P + r - t | 0 : aa - t + n | 0;
      p = r + x | 0;
      zj(e, 32, K, p, I);
      if (!(c[e >> 2] & 32)) Ii(y, x, e) | 0;
      zj(e, 48, K, p, I ^ 65536);
      n = n - Z | 0;
      if (!(c[e >> 2] & 32)) Ii(da, n, e) | 0;
      o = $ - t | 0;
      zj(e, 48, r - (n + o) | 0, 0, 0);
      if (!(c[e >> 2] & 32)) Ii(t, o, e) | 0;
      zj(e, 32, K, p, I ^ 8192);
      n = (p | 0) < (K | 0) ? K : p;
      break;
     }
     n = (r | 0) < 0 ? 6 : r;
     if (o) {
      o = (c[ea >> 2] | 0) + -28 | 0;
      c[ea >> 2] = o;
      q = v * 268435456.0;
     } else {
      q = v;
      o = c[ea >> 2] | 0;
     }
     F = (o | 0) < 0 ? ca : Q;
     E = F;
     o = F;
     do {
      B = ~~q >>> 0;
      c[o >> 2] = B;
      o = o + 4 | 0;
      q = (q - +(B >>> 0)) * 1.0e9;
     } while (q != 0.0);
     p = o;
     o = c[ea >> 2] | 0;
     if ((o | 0) > 0) {
      s = F;
      while (1) {
       t = (o | 0) > 29 ? 29 : o;
       r = p + -4 | 0;
       do if (r >>> 0 < s >>> 0) r = s; else {
        o = 0;
        do {
         B = Kj(c[r >> 2] | 0, 0, t | 0) | 0;
         B = Lj(B | 0, C | 0, o | 0, 0) | 0;
         o = C;
         A = Yj(B | 0, o | 0, 1e9, 0) | 0;
         c[r >> 2] = A;
         o = Xj(B | 0, o | 0, 1e9, 0) | 0;
         r = r + -4 | 0;
        } while (r >>> 0 >= s >>> 0);
        if (!o) {
         r = s;
         break;
        }
        r = s + -4 | 0;
        c[r >> 2] = o;
       } while (0);
       while (1) {
        if (p >>> 0 <= r >>> 0) break;
        o = p + -4 | 0;
        if (!(c[o >> 2] | 0)) p = o; else break;
       }
       o = (c[ea >> 2] | 0) - t | 0;
       c[ea >> 2] = o;
       if ((o | 0) > 0) s = r; else break;
      }
     } else r = F;
     if ((o | 0) < 0) {
      y = ((n + 25 | 0) / 9 | 0) + 1 | 0;
      z = (D | 0) == 102;
      w = r;
      while (1) {
       x = 0 - o | 0;
       x = (x | 0) > 9 ? 9 : x;
       do if (w >>> 0 < p >>> 0) {
        o = (1 << x) + -1 | 0;
        s = 1e9 >>> x;
        r = 0;
        t = w;
        do {
         B = c[t >> 2] | 0;
         c[t >> 2] = (B >>> x) + r;
         r = _(B & o, s) | 0;
         t = t + 4 | 0;
        } while (t >>> 0 < p >>> 0);
        o = (c[w >> 2] | 0) == 0 ? w + 4 | 0 : w;
        if (!r) {
         r = o;
         break;
        }
        c[p >> 2] = r;
        r = o;
        p = p + 4 | 0;
       } else r = (c[w >> 2] | 0) == 0 ? w + 4 | 0 : w; while (0);
       o = z ? F : r;
       p = (p - o >> 2 | 0) > (y | 0) ? o + (y << 2) | 0 : p;
       o = (c[ea >> 2] | 0) + x | 0;
       c[ea >> 2] = o;
       if ((o | 0) >= 0) {
        w = r;
        break;
       } else w = r;
      }
     } else w = r;
     do if (w >>> 0 < p >>> 0) {
      o = (E - w >> 2) * 9 | 0;
      s = c[w >> 2] | 0;
      if (s >>> 0 < 10) break; else r = 10;
      do {
       r = r * 10 | 0;
       o = o + 1 | 0;
      } while (s >>> 0 >= r >>> 0);
     } else o = 0; while (0);
     A = (D | 0) == 103;
     B = (n | 0) != 0;
     r = n - ((D | 0) != 102 ? o : 0) + ((B & A) << 31 >> 31) | 0;
     if ((r | 0) < (((p - E >> 2) * 9 | 0) + -9 | 0)) {
      t = r + 9216 | 0;
      z = (t | 0) / 9 | 0;
      r = F + (z + -1023 << 2) | 0;
      t = ((t | 0) % 9 | 0) + 1 | 0;
      if ((t | 0) < 9) {
       s = 10;
       do {
        s = s * 10 | 0;
        t = t + 1 | 0;
       } while ((t | 0) != 9);
      } else s = 10;
      x = c[r >> 2] | 0;
      y = (x >>> 0) % (s >>> 0) | 0;
      if (!y) if ((F + (z + -1022 << 2) | 0) == (p | 0)) s = w; else L = 163; else L = 163;
      do if ((L | 0) == 163) {
       L = 0;
       v = (((x >>> 0) / (s >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0;
       t = (s | 0) / 2 | 0;
       do if (y >>> 0 < t >>> 0) q = .5; else {
        if ((y | 0) == (t | 0)) if ((F + (z + -1022 << 2) | 0) == (p | 0)) {
         q = 1.0;
         break;
        }
        q = 1.5;
       } while (0);
       do if (G) {
        if ((a[H >> 0] | 0) != 45) break;
        v = -v;
        q = -q;
       } while (0);
       t = x - y | 0;
       c[r >> 2] = t;
       if (!(v + q != v)) {
        s = w;
        break;
       }
       D = t + s | 0;
       c[r >> 2] = D;
       if (D >>> 0 > 999999999) {
        o = w;
        while (1) {
         s = r + -4 | 0;
         c[r >> 2] = 0;
         if (s >>> 0 < o >>> 0) {
          o = o + -4 | 0;
          c[o >> 2] = 0;
         }
         D = (c[s >> 2] | 0) + 1 | 0;
         c[s >> 2] = D;
         if (D >>> 0 > 999999999) r = s; else {
          w = o;
          r = s;
          break;
         }
        }
       }
       o = (E - w >> 2) * 9 | 0;
       t = c[w >> 2] | 0;
       if (t >>> 0 < 10) {
        s = w;
        break;
       } else s = 10;
       do {
        s = s * 10 | 0;
        o = o + 1 | 0;
       } while (t >>> 0 >= s >>> 0);
       s = w;
      } while (0);
      D = r + 4 | 0;
      w = s;
      p = p >>> 0 > D >>> 0 ? D : p;
     }
     y = 0 - o | 0;
     while (1) {
      if (p >>> 0 <= w >>> 0) {
       z = 0;
       D = p;
       break;
      }
      r = p + -4 | 0;
      if (!(c[r >> 2] | 0)) p = r; else {
       z = 1;
       D = p;
       break;
      }
     }
     do if (A) {
      n = (B & 1 ^ 1) + n | 0;
      if ((n | 0) > (o | 0) & (o | 0) > -5) {
       u = u + -1 | 0;
       n = n + -1 - o | 0;
      } else {
       u = u + -2 | 0;
       n = n + -1 | 0;
      }
      p = I & 8;
      if (p) break;
      do if (z) {
       p = c[D + -4 >> 2] | 0;
       if (!p) {
        r = 9;
        break;
       }
       if (!((p >>> 0) % 10 | 0)) {
        s = 10;
        r = 0;
       } else {
        r = 0;
        break;
       }
       do {
        s = s * 10 | 0;
        r = r + 1 | 0;
       } while (((p >>> 0) % (s >>> 0) | 0 | 0) == 0);
      } else r = 9; while (0);
      p = ((D - E >> 2) * 9 | 0) + -9 | 0;
      if ((u | 32 | 0) == 102) {
       p = p - r | 0;
       p = (p | 0) < 0 ? 0 : p;
       n = (n | 0) < (p | 0) ? n : p;
       p = 0;
       break;
      } else {
       p = p + o - r | 0;
       p = (p | 0) < 0 ? 0 : p;
       n = (n | 0) < (p | 0) ? n : p;
       p = 0;
       break;
      }
     } else p = I & 8; while (0);
     x = n | p;
     s = (x | 0) != 0 & 1;
     t = (u | 32 | 0) == 102;
     if (t) {
      o = (o | 0) > 0 ? o : 0;
      u = 0;
     } else {
      r = (o | 0) < 0 ? y : o;
      r = yj(r, ((r | 0) < 0) << 31 >> 31, X) | 0;
      if (($ - r | 0) < 2) do {
       r = r + -1 | 0;
       a[r >> 0] = 48;
      } while (($ - r | 0) < 2);
      a[r + -1 >> 0] = (o >> 31 & 2) + 43;
      E = r + -2 | 0;
      a[E >> 0] = u;
      o = $ - E | 0;
      u = E;
     }
     y = G + 1 + n + s + o | 0;
     zj(e, 32, K, y, I);
     if (!(c[e >> 2] & 32)) Ii(H, G, e) | 0;
     zj(e, 48, K, y, I ^ 65536);
     do if (t) {
      r = w >>> 0 > F >>> 0 ? F : w;
      o = r;
      do {
       p = yj(c[o >> 2] | 0, 0, R) | 0;
       do if ((o | 0) == (r | 0)) {
        if ((p | 0) != (R | 0)) break;
        a[T >> 0] = 48;
        p = T;
       } else {
        if (p >>> 0 <= da >>> 0) break;
        do {
         p = p + -1 | 0;
         a[p >> 0] = 48;
        } while (p >>> 0 > da >>> 0);
       } while (0);
       if (!(c[e >> 2] & 32)) Ii(p, S - p | 0, e) | 0;
       o = o + 4 | 0;
      } while (o >>> 0 <= F >>> 0);
      do if (x) {
       if (c[e >> 2] & 32) break;
       Ii(34049, 1, e) | 0;
      } while (0);
      if ((n | 0) > 0 & o >>> 0 < D >>> 0) {
       p = o;
       while (1) {
        o = yj(c[p >> 2] | 0, 0, R) | 0;
        if (o >>> 0 > da >>> 0) do {
         o = o + -1 | 0;
         a[o >> 0] = 48;
        } while (o >>> 0 > da >>> 0);
        if (!(c[e >> 2] & 32)) Ii(o, (n | 0) > 9 ? 9 : n, e) | 0;
        p = p + 4 | 0;
        o = n + -9 | 0;
        if (!((n | 0) > 9 & p >>> 0 < D >>> 0)) {
         n = o;
         break;
        } else n = o;
       }
      }
      zj(e, 48, n + 9 | 0, 9, 0);
     } else {
      t = z ? D : w + 4 | 0;
      if ((n | 0) > -1) {
       s = (p | 0) == 0;
       r = w;
       do {
        o = yj(c[r >> 2] | 0, 0, R) | 0;
        if ((o | 0) == (R | 0)) {
         a[T >> 0] = 48;
         o = T;
        }
        do if ((r | 0) == (w | 0)) {
         p = o + 1 | 0;
         if (!(c[e >> 2] & 32)) Ii(o, 1, e) | 0;
         if (s & (n | 0) < 1) {
          o = p;
          break;
         }
         if (c[e >> 2] & 32) {
          o = p;
          break;
         }
         Ii(34049, 1, e) | 0;
         o = p;
        } else {
         if (o >>> 0 <= da >>> 0) break;
         do {
          o = o + -1 | 0;
          a[o >> 0] = 48;
         } while (o >>> 0 > da >>> 0);
        } while (0);
        p = S - o | 0;
        if (!(c[e >> 2] & 32)) Ii(o, (n | 0) > (p | 0) ? p : n, e) | 0;
        n = n - p | 0;
        r = r + 4 | 0;
       } while (r >>> 0 < t >>> 0 & (n | 0) > -1);
      }
      zj(e, 48, n + 18 | 0, 18, 0);
      if (c[e >> 2] & 32) break;
      Ii(u, $ - u | 0, e) | 0;
     } while (0);
     zj(e, 32, K, y, I ^ 8192);
     n = (y | 0) < (K | 0) ? K : y;
    } else {
     t = (u & 32 | 0) != 0;
     s = q != q | 0.0 != 0.0;
     o = s ? 0 : G;
     r = o + 3 | 0;
     zj(e, 32, K, r, p);
     n = c[e >> 2] | 0;
     if (!(n & 32)) {
      Ii(H, o, e) | 0;
      n = c[e >> 2] | 0;
     }
     if (!(n & 32)) Ii(s ? (t ? 34041 : 34045) : t ? 34033 : 34037, 3, e) | 0;
     zj(e, 32, K, r, I ^ 8192);
     n = (r | 0) < (K | 0) ? K : r;
    } while (0);
    w = J;
    continue a;
   }
  default:
   {
    p = I;
    o = r;
    t = 0;
    u = 33997;
    n = N;
   }
  } while (0);
  g : do if ((L | 0) == 64) {
   p = ba;
   o = c[p >> 2] | 0;
   p = c[p + 4 >> 2] | 0;
   s = u & 32;
   if ((o | 0) == 0 & (p | 0) == 0) {
    n = N;
    o = t;
    t = 0;
    s = 33997;
    L = 77;
   } else {
    n = N;
    do {
     n = n + -1 | 0;
     a[n >> 0] = d[33981 + (o & 15) >> 0] | s;
     o = Nj(o | 0, p | 0, 4) | 0;
     p = C;
    } while (!((o | 0) == 0 & (p | 0) == 0));
    L = ba;
    if ((t & 8 | 0) == 0 | (c[L >> 2] | 0) == 0 & (c[L + 4 >> 2] | 0) == 0) {
     o = t;
     t = 0;
     s = 33997;
     L = 77;
    } else {
     o = t;
     t = 2;
     s = 33997 + (u >> 4) | 0;
     L = 77;
    }
   }
  } else if ((L | 0) == 76) {
   n = yj(n, o, N) | 0;
   o = I;
   t = p;
   L = 77;
  } else if ((L | 0) == 82) {
   L = 0;
   I = ti(n, 0, r) | 0;
   H = (I | 0) == 0;
   w = n;
   o = H ? r : I - n | 0;
   t = 0;
   u = 33997;
   n = H ? n + r | 0 : I;
  } else if ((L | 0) == 86) {
   L = 0;
   o = 0;
   n = 0;
   s = c[ba >> 2] | 0;
   while (1) {
    p = c[s >> 2] | 0;
    if (!p) break;
    n = ei(fa, p) | 0;
    if ((n | 0) < 0 | n >>> 0 > (r - o | 0) >>> 0) break;
    o = n + o | 0;
    if (r >>> 0 > o >>> 0) s = s + 4 | 0; else break;
   }
   if ((n | 0) < 0) {
    f = -1;
    break a;
   }
   zj(e, 32, K, o, I);
   if (!o) {
    n = 0;
    L = 98;
   } else {
    p = 0;
    r = c[ba >> 2] | 0;
    while (1) {
     n = c[r >> 2] | 0;
     if (!n) {
      n = o;
      L = 98;
      break g;
     }
     n = ei(fa, n) | 0;
     p = n + p | 0;
     if ((p | 0) > (o | 0)) {
      n = o;
      L = 98;
      break g;
     }
     if (!(c[e >> 2] & 32)) Ii(fa, n, e) | 0;
     if (p >>> 0 >= o >>> 0) {
      n = o;
      L = 98;
      break;
     } else r = r + 4 | 0;
    }
   }
  } while (0);
  if ((L | 0) == 98) {
   L = 0;
   zj(e, 32, K, n, I ^ 8192);
   w = J;
   n = (K | 0) > (n | 0) ? K : n;
   continue;
  }
  if ((L | 0) == 77) {
   L = 0;
   p = (r | 0) > -1 ? o & -65537 : o;
   o = ba;
   o = (c[o >> 2] | 0) != 0 | (c[o + 4 >> 2] | 0) != 0;
   if ((r | 0) != 0 | o) {
    o = (o & 1 ^ 1) + (U - n) | 0;
    w = n;
    o = (r | 0) > (o | 0) ? r : o;
    u = s;
    n = N;
   } else {
    w = N;
    o = 0;
    u = s;
    n = N;
   }
  }
  s = n - w | 0;
  o = (o | 0) < (s | 0) ? s : o;
  r = t + o | 0;
  n = (K | 0) < (r | 0) ? r : K;
  zj(e, 32, n, r, p);
  if (!(c[e >> 2] & 32)) Ii(u, t, e) | 0;
  zj(e, 48, n, r, p ^ 65536);
  zj(e, 48, o, s, 0);
  if (!(c[e >> 2] & 32)) Ii(w, s, e) | 0;
  zj(e, 32, n, r, p ^ 8192);
  w = J;
 }
 h : do if ((L | 0) == 245) if (!e) if (!m) f = 0; else {
  f = 1;
  while (1) {
   m = c[l + (f << 2) >> 2] | 0;
   if (!m) break;
   xj(j + (f << 3) | 0, m, g);
   f = f + 1 | 0;
   if ((f | 0) >= 10) {
    f = 1;
    break h;
   }
  }
  if ((f | 0) < 10) while (1) {
   if (c[l + (f << 2) >> 2] | 0) {
    f = -1;
    break h;
   }
   f = f + 1 | 0;
   if ((f | 0) >= 10) {
    f = 1;
    break;
   }
  } else f = 1;
 } while (0);
 i = ha;
 return f | 0;
}

function Ee() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 q = i;
 i = i + 160 | 0;
 p = q + 152 | 0;
 o = q + 144 | 0;
 l = q + 128 | 0;
 k = q + 112 | 0;
 j = q + 96 | 0;
 g = q + 80 | 0;
 f = q + 64 | 0;
 e = q + 48 | 0;
 m = q + 32 | 0;
 h = q + 16 | 0;
 b = q;
 c[169] = 0;
 while (1) {
  if (!((_c(64) | 0) != 0 ^ 1)) break;
  if (!(yb(c[(c[338] | 0) + (c[115] << 2) >> 2] | 0) | 0)) {
   n = 129;
   break;
  }
  c[168] = (c[168] | 0) + 1;
  c[67] = 0;
 }
 if ((n | 0) == 129) {
  i = q;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 64) {
  r = c[11] | 0;
  s = d[8933] | 0;
  c[b >> 2] = 14711;
  c[b + 4 >> 2] = s;
  c[b + 8 >> 2] = 14716;
  $i(r, 12651, b) | 0;
  b = c[12] | 0;
  r = d[8933] | 0;
  c[h >> 2] = 14711;
  c[h + 4 >> 2] = r;
  c[h + 8 >> 2] = 14716;
  $i(b, 12651, h) | 0;
  wb();
  xa(96, 1);
 }
 c[67] = (c[67] | 0) + 1;
 if (!(od() | 0)) {
  kc();
  i = q;
  return;
 }
 ed(123, 40, 40);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  qc();
  Qi(14730, c[11] | 0) | 0;
  Qi(14730, c[12] | 0) | 0;
  hc();
  i = q;
  return;
 }
 Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 s = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 12, 0) | 0;
 c[343] = c[(c[271] | 0) + (s << 2) >> 2];
 a : do if (c[263] | 0) {
  c[169] = 1;
  switch (c[343] | 0) {
  case 1:
   {
    if ((c[326] | 0) == (c[689] | 0)) {
     s = c[11] | 0;
     p = (c[689] | 0) + 20 | 0;
     r = c[689] | 0;
     c[m >> 2] = 13832;
     c[m + 4 >> 2] = 4;
     c[m + 8 >> 2] = p;
     c[m + 12 >> 2] = r;
     $i(s, 9481, m) | 0;
     c[116] = mh(c[116] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
     s = c[11] | 0;
     r = (c[689] | 0) + 20 | 0;
     p = c[689] | 0;
     c[e >> 2] = 13841;
     c[e + 4 >> 2] = 4;
     c[e + 8 >> 2] = r;
     c[e + 12 >> 2] = p;
     $i(s, 9481, e) | 0;
     c[338] = mh(c[338] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
     s = c[11] | 0;
     p = (c[689] | 0) + 20 | 0;
     r = c[689] | 0;
     c[f >> 2] = 13850;
     c[f + 4 >> 2] = 4;
     c[f + 8 >> 2] = p;
     c[f + 12 >> 2] = r;
     $i(s, 9481, f) | 0;
     c[347] = mh(c[347] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
     c[689] = (c[689] | 0) + 20;
    }
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    do if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 123) a[9383] = 125; else {
     if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 40) {
      a[9383] = 41;
      break;
     }
     lc(123, 40);
     i = q;
     return;
    } while (0);
    c[67] = (c[67] | 0) + 1;
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    c[340] = 1;
    if (!(sd() | 0)) {
     i = q;
     return;
    }
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[9383] | 0 | 0)) {
     s = c[11] | 0;
     r = d[8869 + (d[9383] | 0) >> 0] | 0;
     c[g >> 2] = 14744;
     c[g + 4 >> 2] = r;
     c[g + 8 >> 2] = 14754;
     $i(s, 12651, g) | 0;
     s = c[12] | 0;
     r = d[8869 + (d[9383] | 0) >> 0] | 0;
     c[j >> 2] = 14744;
     c[j + 4 >> 2] = r;
     c[j + 8 >> 2] = 14754;
     $i(s, 12651, j) | 0;
     hc();
     i = q;
     return;
    } else {
     c[67] = (c[67] | 0) + 1;
     i = q;
     return;
    }
   }
  case 2:
   {
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    do if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 123) a[9383] = 125; else {
     if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 40) {
      a[9383] = 41;
      break;
     }
     lc(123, 40);
     i = q;
     return;
    } while (0);
    c[67] = (c[67] | 0) + 1;
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    ed(61, 61, 61);
    if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
     qc();
     Qi(14776, c[11] | 0) | 0;
     Qi(14776, c[12] | 0) | 0;
     hc();
     i = q;
     return;
    }
    Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
    c[344] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 13, 1) | 0;
    c[(c[271] | 0) + (c[344] << 2) >> 2] = c[(c[167] | 0) + (c[344] << 2) >> 2];
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 61) {
     mc();
     i = q;
     return;
    }
    c[67] = (c[67] | 0) + 1;
    if (!(od() | 0)) {
     kc();
     i = q;
     return;
    }
    c[340] = 1;
    if (!(sd() | 0)) {
     i = q;
     return;
    }
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[9383] | 0 | 0)) {
     s = c[11] | 0;
     r = d[8869 + (d[9383] | 0) >> 0] | 0;
     c[k >> 2] = 14744;
     c[k + 4 >> 2] = r;
     c[k + 8 >> 2] = 14790;
     $i(s, 12651, k) | 0;
     s = c[12] | 0;
     r = d[8869 + (d[9383] | 0) >> 0] | 0;
     c[l >> 2] = 14744;
     c[l + 4 >> 2] = r;
     c[l + 8 >> 2] = 14790;
     $i(s, 12651, l) | 0;
     hc();
     i = q;
     return;
    } else {
     c[67] = (c[67] | 0) + 1;
     i = q;
     return;
    }
   }
  case 0:
   {
    i = q;
    return;
   }
  default:
   {
    rc();
    break a;
   }
  }
 } else {
  c[700] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 0) | 0;
  if (c[263] | 0) if ((d[(c[166] | 0) + (c[700] | 0) >> 0] | 0 | 0) == 1) {
   c[701] = 1;
   break;
  }
  c[701] = 0;
 } while (0);
 if (!(od() | 0)) {
  kc();
  i = q;
  return;
 }
 do if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 123) a[9383] = 125; else {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 40) {
   a[9383] = 41;
   break;
  }
  lc(123, 40);
  i = q;
  return;
 } while (0);
 c[67] = (c[67] | 0) + 1;
 if (!(od() | 0)) {
  kc();
  i = q;
  return;
 }
 if ((d[9383] | 0 | 0) == 41) $c(44) | 0; else bd(44, 125) | 0;
 c[274] = c[66];
 while (1) {
  if ((c[274] | 0) >= (c[67] | 0)) break;
  a[(c[17] | 0) + (c[274] | 0) >> 0] = a[(c[15] | 0) + (c[274] | 0) >> 0] | 0;
  c[274] = (c[274] | 0) + 1;
 }
 Oc(c[17] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 b = c[17] | 0;
 e = c[66] | 0;
 f = (c[67] | 0) - (c[66] | 0) | 0;
 if (c[350] | 0) c[272] = Qc(b, e, f, 10, 1) | 0; else c[272] = Qc(b, e, f, 10, 0) | 0;
 do if (c[263] | 0) {
  c[348] = c[(c[271] | 0) + (c[(c[271] | 0) + (c[272] << 2) >> 2] << 2) >> 2];
  if (c[350] | 0) {
   if ((c[348] | 0) < (c[693] | 0)) n = 78; else if ((c[348] | 0) >= (c[351] | 0)) n = 78; else if (!(c[(c[123] | 0) + (c[348] << 2) >> 2] | 0)) {
    c[273] = 0;
    c[274] = c[(c[63] | 0) + (c[(c[124] | 0) + (c[348] << 2) >> 2] << 2) >> 2];
    c[275] = c[(c[63] | 0) + ((c[(c[124] | 0) + (c[348] << 2) >> 2] | 0) + 1 << 2) >> 2];
    while (1) {
     if ((c[274] | 0) >= (c[275] | 0)) break;
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[274] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     c[274] = (c[274] | 0) + 1;
    }
    Oc(c[17] | 0, 0, (c[(c[63] | 0) + ((c[(c[124] | 0) + (c[348] << 2) >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[(c[124] | 0) + (c[348] << 2) >> 2] << 2) >> 2] | 0) | 0);
    c[702] = Qc(c[17] | 0, 0, (c[(c[63] | 0) + ((c[(c[124] | 0) + (c[348] << 2) >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[(c[124] | 0) + (c[348] << 2) >> 2] << 2) >> 2] | 0) | 0, 10, 0) | 0;
    if (!(c[263] | 0)) sc();
    if ((c[702] | 0) == (c[272] | 0)) break;
   }
  } else n = 78;
  if ((n | 0) == 78) if (!(c[(c[122] | 0) + (c[348] << 2) >> 2] | 0)) {
   if (c[350] | 0) break;
   if ((c[348] | 0) < (c[351] | 0)) break;
   c[270] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 9, 1) | 0;
   if (c[263] | 0) break;
   c[(c[271] | 0) + (c[272] << 2) >> 2] = c[270];
   c[(c[271] | 0) + (c[270] << 2) >> 2] = c[348];
   c[(c[121] | 0) + (c[348] << 2) >> 2] = c[(c[167] | 0) + (c[270] << 2) >> 2];
   c[263] = 1;
   break;
  }
  b = c[11] | 0;
  if (!(c[(c[122] | 0) + (c[348] << 2) >> 2] | 0)) {
   Qi(14810, b) | 0;
   Qi(14810, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
  Qi(14837, b) | 0;
  Qi(14837, c[12] | 0) | 0;
  hc();
  i = q;
  return;
 } while (0);
 c[703] = 1;
 b = (c[263] | 0) != 0;
 do if (c[350] | 0) {
  if (b) {
   if ((c[348] | 0) < (c[693] | 0)) break;
   c[(c[123] | 0) + (c[348] << 2) >> 2] = 1;
   c[270] = c[(c[271] | 0) + (c[272] << 2) >> 2];
  } else {
   c[270] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 9, 1) | 0;
   if (c[263] | 0) Tb();
  }
  c[348] = c[172];
  Tc(688);
 } else if (!b) c[703] = 0; while (0);
 do if (c[703] | 0) if (c[701] | 0) {
  c[(c[122] | 0) + (c[348] << 2) >> 2] = c[700];
  break;
 } else {
  c[(c[122] | 0) + (c[348] << 2) >> 2] = c[408];
  Qi(14852, c[11] | 0) | 0;
  Qi(14852, c[12] | 0) | 0;
  Db();
  s = c[11] | 0;
  c[o >> 2] = 14878;
  $i(s, 16602, o) | 0;
  s = c[12] | 0;
  c[p >> 2] = 14878;
  $i(s, 16602, p) | 0;
  ic();
  break;
 } while (0);
 if (!(od() | 0)) {
  kc();
  i = q;
  return;
 }
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == (d[9383] | 0 | 0)) {
   n = 128;
   break;
  }
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 44) {
   n = 110;
   break;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(od() | 0)) {
   n = 112;
   break;
  }
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == (d[9383] | 0 | 0)) {
   n = 128;
   break;
  }
  ed(61, 61, 61);
  if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
   n = 116;
   break;
  }
  c[340] = 0;
  do if (c[703] | 0) {
   Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
   c[349] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 0) | 0;
   if (!(c[263] | 0)) break;
   if ((d[(c[166] | 0) + (c[349] | 0) >> 0] | 0 | 0) != 4) break;
   c[340] = 1;
  } while (0);
  if (!(od() | 0)) {
   n = 122;
   break;
  }
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 61) {
   n = 124;
   break;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(od() | 0)) {
   n = 126;
   break;
  }
  if (!(sd() | 0)) {
   n = 129;
   break;
  }
 }
 if ((n | 0) == 110) {
  lc(44, a[9383] | 0);
  i = q;
  return;
 } else if ((n | 0) == 112) {
  kc();
  i = q;
  return;
 } else if ((n | 0) == 116) {
  qc();
  Qi(14905, c[11] | 0) | 0;
  Qi(14905, c[12] | 0) | 0;
  hc();
  i = q;
  return;
 } else if ((n | 0) == 122) {
  kc();
  i = q;
  return;
 } else if ((n | 0) == 124) {
  mc();
  i = q;
  return;
 } else if ((n | 0) == 126) {
  kc();
  i = q;
  return;
 } else if ((n | 0) == 128) {
  c[67] = (c[67] | 0) + 1;
  i = q;
  return;
 } else if ((n | 0) == 129) {
  i = q;
  return;
 }
}

function nd(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0;
 x = i;
 i = i + 208 | 0;
 w = x + 160 | 0;
 v = x + 144 | 0;
 o = x + 128 | 0;
 m = x + 112 | 0;
 l = x + 96 | 0;
 k = x + 80 | 0;
 j = x + 64 | 0;
 h = x + 48 | 0;
 p = x + 32 | 0;
 n = x + 16 | 0;
 g = x;
 q = x + 200 | 0;
 u = x + 196 | 0;
 s = x + 192 | 0;
 t = x + 188 | 0;
 r = x + 184 | 0;
 e = x + 180 | 0;
 f = x + 176 | 0;
 c[q >> 2] = b;
 c[s >> 2] = 50;
 c[u >> 2] = kh((c[s >> 2] | 0) + 1 << 2) | 0;
 if (!(id() | 0)) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  w = c[u >> 2] | 0;
  Cj(w);
  i = x;
  return;
 }
 c[t >> 2] = 0;
 a : while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   e = 53;
   break;
  }
  b : do switch (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) {
  case 35:
   {
    c[67] = (c[67] | 0) + 1;
    if (!(gd() | 0)) {
     Qi(12601, c[11] | 0) | 0;
     Qi(12601, c[12] | 0) | 0;
     jd();
     break b;
    }
    c[331] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 1, 1) | 0;
    if (!(c[263] | 0)) {
     a[(c[166] | 0) + (c[331] | 0) >> 0] = 2;
     c[(c[271] | 0) + (c[331] << 2) >> 2] = c[330];
    }
    if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) < (c[21] | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 37) {
     md();
     break b;
    }
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[331];
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     b = c[11] | 0;
     z = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[g >> 2] = 12636;
     c[g + 4 >> 2] = 4;
     c[g + 8 >> 2] = z;
     c[g + 12 >> 2] = y;
     $i(b, 9481, g) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    break;
   }
  case 34:
   {
    c[67] = (c[67] | 0) + 1;
    if (!(_c(34) | 0)) {
     z = c[11] | 0;
     y = d[8903] | 0;
     c[n >> 2] = 12658;
     c[n + 4 >> 2] = y;
     c[n + 8 >> 2] = 12663;
     $i(z, 12651, n) | 0;
     z = c[12] | 0;
     y = d[8903] | 0;
     c[p >> 2] = 12658;
     c[p + 4 >> 2] = y;
     c[p + 8 >> 2] = 12663;
     $i(z, 12651, p) | 0;
     jd();
     break b;
    }
    c[331] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 0, 1) | 0;
    a[(c[166] | 0) + (c[331] | 0) >> 0] = 3;
    c[67] = (c[67] | 0) + 1;
    if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) < (c[21] | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 37) {
     md();
     break b;
    }
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[331];
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[h >> 2] = 12636;
     c[h + 4 >> 2] = 4;
     c[h + 8 >> 2] = b;
     c[h + 12 >> 2] = y;
     $i(z, 9481, h) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    break;
   }
  case 39:
   {
    c[67] = (c[67] | 0) + 1;
    bd(125, 37) | 0;
    Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
    c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 0) | 0;
    if (!(c[263] | 0)) {
     ld();
     break b;
    }
    if ((c[332] | 0) == (c[333] | 0)) {
     kd();
     break b;
    }
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = 0;
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[j >> 2] = 12636;
     c[j + 4 >> 2] = 4;
     c[j + 8 >> 2] = b;
     c[j + 12 >> 2] = y;
     $i(z, 9481, j) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[332];
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[k >> 2] = 12636;
     c[k + 4 >> 2] = 4;
     c[k + 8 >> 2] = b;
     c[k + 12 >> 2] = y;
     $i(z, 9481, k) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    break;
   }
  case 123:
   {
    a[c[17] >> 0] = 39;
    Sc(c[334] | 0, c[17] | 0, 1, e);
    c[f >> 2] = Qc(c[17] | 0, 0, c[e >> 2] | 0, 11, 1) | 0;
    if (c[263] | 0) {
     e = 38;
     break a;
    }
    c[334] = (c[334] | 0) + 1;
    a[(c[166] | 0) + (c[f >> 2] | 0) >> 0] = 1;
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = 0;
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[l >> 2] = 12636;
     c[l + 4 >> 2] = 4;
     c[l + 8 >> 2] = b;
     c[l + 12 >> 2] = y;
     $i(z, 9481, l) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[f >> 2];
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[m >> 2] = 12636;
     c[m + 4 >> 2] = 4;
     c[m + 8 >> 2] = b;
     c[m + 12 >> 2] = y;
     $i(z, 9481, m) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
    c[67] = (c[67] | 0) + 1;
    nd(c[f >> 2] | 0);
    break;
   }
  default:
   {
    bd(125, 37) | 0;
    Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
    c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 0) | 0;
    if (!(c[263] | 0)) {
     ld();
     break b;
    }
    if ((c[332] | 0) == (c[333] | 0)) {
     kd();
     break b;
    }
    c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[332];
    if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
     z = c[11] | 0;
     b = (c[s >> 2] | 0) + 50 | 0;
     y = c[s >> 2] | 0;
     c[o >> 2] = 12636;
     c[o + 4 >> 2] = 4;
     c[o + 8 >> 2] = b;
     c[o + 12 >> 2] = y;
     $i(z, 9481, o) | 0;
     c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
     c[s >> 2] = (c[s >> 2] | 0) + 50;
    }
    c[t >> 2] = (c[t >> 2] | 0) + 1;
   }
  } while (0);
  if (!(id() | 0)) {
   e = 52;
   break;
  }
 }
 if ((e | 0) == 38) {
  Qi(12687, c[11] | 0) | 0;
  Qi(12687, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 } else if ((e | 0) == 52) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  z = c[u >> 2] | 0;
  Cj(z);
  i = x;
  return;
 } else if ((e | 0) == 53) {
  c[(c[u >> 2] | 0) + (c[t >> 2] << 2) >> 2] = c[335];
  if ((c[t >> 2] | 0) == (c[s >> 2] | 0)) {
   z = c[11] | 0;
   p = (c[s >> 2] | 0) + 50 | 0;
   y = c[s >> 2] | 0;
   c[v >> 2] = 12636;
   c[v + 4 >> 2] = 4;
   c[v + 8 >> 2] = p;
   c[v + 12 >> 2] = y;
   $i(z, 9481, v) | 0;
   c[u >> 2] = mh(c[u >> 2] | 0, (c[s >> 2] | 0) + 50 + 1 << 2) | 0;
   c[s >> 2] = (c[s >> 2] | 0) + 50;
  }
  c[t >> 2] = (c[t >> 2] | 0) + 1;
  while (1) {
   if (((c[t >> 2] | 0) + (c[180] | 0) | 0) <= (c[336] | 0)) break;
   z = c[11] | 0;
   v = (c[336] | 0) + 3e3 | 0;
   y = c[336] | 0;
   c[w >> 2] = 12725;
   c[w + 4 >> 2] = 4;
   c[w + 8 >> 2] = v;
   c[w + 12 >> 2] = y;
   $i(z, 9481, w) | 0;
   c[337] = mh(c[337] | 0, (c[336] | 0) + 3e3 + 1 << 2) | 0;
   c[336] = (c[336] | 0) + 3e3;
  }
  c[(c[271] | 0) + (c[q >> 2] << 2) >> 2] = c[180];
  c[r >> 2] = 0;
  while (1) {
   if ((c[r >> 2] | 0) >= (c[t >> 2] | 0)) break;
   c[(c[337] | 0) + (c[180] << 2) >> 2] = c[(c[u >> 2] | 0) + (c[r >> 2] << 2) >> 2];
   c[r >> 2] = (c[r >> 2] | 0) + 1;
   c[180] = (c[180] | 0) + 1;
  }
  c[67] = (c[67] | 0) + 1;
  z = c[u >> 2] | 0;
  Cj(z);
  i = x;
  return;
 }
}

function Cj(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0;
 if (!a) return;
 b = a + -8 | 0;
 i = c[1969] | 0;
 if (b >>> 0 < i >>> 0) oa();
 d = c[a + -4 >> 2] | 0;
 e = d & 3;
 if ((e | 0) == 1) oa();
 o = d & -8;
 q = a + (o + -8) | 0;
 do if (!(d & 1)) {
  b = c[b >> 2] | 0;
  if (!e) return;
  j = -8 - b | 0;
  l = a + j | 0;
  m = b + o | 0;
  if (l >>> 0 < i >>> 0) oa();
  if ((l | 0) == (c[1970] | 0)) {
   b = a + (o + -4) | 0;
   d = c[b >> 2] | 0;
   if ((d & 3 | 0) != 3) {
    u = l;
    g = m;
    break;
   }
   c[1967] = m;
   c[b >> 2] = d & -2;
   c[a + (j + 4) >> 2] = m | 1;
   c[q >> 2] = m;
   return;
  }
  f = b >>> 3;
  if (b >>> 0 < 256) {
   e = c[a + (j + 8) >> 2] | 0;
   d = c[a + (j + 12) >> 2] | 0;
   b = 7900 + (f << 1 << 2) | 0;
   if ((e | 0) != (b | 0)) {
    if (e >>> 0 < i >>> 0) oa();
    if ((c[e + 12 >> 2] | 0) != (l | 0)) oa();
   }
   if ((d | 0) == (e | 0)) {
    c[1965] = c[1965] & ~(1 << f);
    u = l;
    g = m;
    break;
   }
   if ((d | 0) == (b | 0)) h = d + 8 | 0; else {
    if (d >>> 0 < i >>> 0) oa();
    b = d + 8 | 0;
    if ((c[b >> 2] | 0) == (l | 0)) h = b; else oa();
   }
   c[e + 12 >> 2] = d;
   c[h >> 2] = e;
   u = l;
   g = m;
   break;
  }
  h = c[a + (j + 24) >> 2] | 0;
  e = c[a + (j + 12) >> 2] | 0;
  do if ((e | 0) == (l | 0)) {
   d = a + (j + 20) | 0;
   b = c[d >> 2] | 0;
   if (!b) {
    d = a + (j + 16) | 0;
    b = c[d >> 2] | 0;
    if (!b) {
     k = 0;
     break;
    }
   }
   while (1) {
    e = b + 20 | 0;
    f = c[e >> 2] | 0;
    if (f) {
     b = f;
     d = e;
     continue;
    }
    e = b + 16 | 0;
    f = c[e >> 2] | 0;
    if (!f) break; else {
     b = f;
     d = e;
    }
   }
   if (d >>> 0 < i >>> 0) oa(); else {
    c[d >> 2] = 0;
    k = b;
    break;
   }
  } else {
   f = c[a + (j + 8) >> 2] | 0;
   if (f >>> 0 < i >>> 0) oa();
   b = f + 12 | 0;
   if ((c[b >> 2] | 0) != (l | 0)) oa();
   d = e + 8 | 0;
   if ((c[d >> 2] | 0) == (l | 0)) {
    c[b >> 2] = e;
    c[d >> 2] = f;
    k = e;
    break;
   } else oa();
  } while (0);
  if (!h) {
   u = l;
   g = m;
  } else {
   b = c[a + (j + 28) >> 2] | 0;
   d = 8164 + (b << 2) | 0;
   if ((l | 0) == (c[d >> 2] | 0)) {
    c[d >> 2] = k;
    if (!k) {
     c[1966] = c[1966] & ~(1 << b);
     u = l;
     g = m;
     break;
    }
   } else {
    if (h >>> 0 < (c[1969] | 0) >>> 0) oa();
    b = h + 16 | 0;
    if ((c[b >> 2] | 0) == (l | 0)) c[b >> 2] = k; else c[h + 20 >> 2] = k;
    if (!k) {
     u = l;
     g = m;
     break;
    }
   }
   d = c[1969] | 0;
   if (k >>> 0 < d >>> 0) oa();
   c[k + 24 >> 2] = h;
   b = c[a + (j + 16) >> 2] | 0;
   do if (b) if (b >>> 0 < d >>> 0) oa(); else {
    c[k + 16 >> 2] = b;
    c[b + 24 >> 2] = k;
    break;
   } while (0);
   b = c[a + (j + 20) >> 2] | 0;
   if (!b) {
    u = l;
    g = m;
   } else if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    c[k + 20 >> 2] = b;
    c[b + 24 >> 2] = k;
    u = l;
    g = m;
    break;
   }
  }
 } else {
  u = b;
  g = o;
 } while (0);
 if (u >>> 0 >= q >>> 0) oa();
 b = a + (o + -4) | 0;
 d = c[b >> 2] | 0;
 if (!(d & 1)) oa();
 if (!(d & 2)) {
  if ((q | 0) == (c[1971] | 0)) {
   t = (c[1968] | 0) + g | 0;
   c[1968] = t;
   c[1971] = u;
   c[u + 4 >> 2] = t | 1;
   if ((u | 0) != (c[1970] | 0)) return;
   c[1970] = 0;
   c[1967] = 0;
   return;
  }
  if ((q | 0) == (c[1970] | 0)) {
   t = (c[1967] | 0) + g | 0;
   c[1967] = t;
   c[1970] = u;
   c[u + 4 >> 2] = t | 1;
   c[u + t >> 2] = t;
   return;
  }
  g = (d & -8) + g | 0;
  f = d >>> 3;
  do if (d >>> 0 < 256) {
   e = c[a + o >> 2] | 0;
   d = c[a + (o | 4) >> 2] | 0;
   b = 7900 + (f << 1 << 2) | 0;
   if ((e | 0) != (b | 0)) {
    if (e >>> 0 < (c[1969] | 0) >>> 0) oa();
    if ((c[e + 12 >> 2] | 0) != (q | 0)) oa();
   }
   if ((d | 0) == (e | 0)) {
    c[1965] = c[1965] & ~(1 << f);
    break;
   }
   if ((d | 0) == (b | 0)) n = d + 8 | 0; else {
    if (d >>> 0 < (c[1969] | 0) >>> 0) oa();
    b = d + 8 | 0;
    if ((c[b >> 2] | 0) == (q | 0)) n = b; else oa();
   }
   c[e + 12 >> 2] = d;
   c[n >> 2] = e;
  } else {
   h = c[a + (o + 16) >> 2] | 0;
   b = c[a + (o | 4) >> 2] | 0;
   do if ((b | 0) == (q | 0)) {
    d = a + (o + 12) | 0;
    b = c[d >> 2] | 0;
    if (!b) {
     d = a + (o + 8) | 0;
     b = c[d >> 2] | 0;
     if (!b) {
      p = 0;
      break;
     }
    }
    while (1) {
     e = b + 20 | 0;
     f = c[e >> 2] | 0;
     if (f) {
      b = f;
      d = e;
      continue;
     }
     e = b + 16 | 0;
     f = c[e >> 2] | 0;
     if (!f) break; else {
      b = f;
      d = e;
     }
    }
    if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
     c[d >> 2] = 0;
     p = b;
     break;
    }
   } else {
    d = c[a + o >> 2] | 0;
    if (d >>> 0 < (c[1969] | 0) >>> 0) oa();
    e = d + 12 | 0;
    if ((c[e >> 2] | 0) != (q | 0)) oa();
    f = b + 8 | 0;
    if ((c[f >> 2] | 0) == (q | 0)) {
     c[e >> 2] = b;
     c[f >> 2] = d;
     p = b;
     break;
    } else oa();
   } while (0);
   if (h) {
    b = c[a + (o + 20) >> 2] | 0;
    d = 8164 + (b << 2) | 0;
    if ((q | 0) == (c[d >> 2] | 0)) {
     c[d >> 2] = p;
     if (!p) {
      c[1966] = c[1966] & ~(1 << b);
      break;
     }
    } else {
     if (h >>> 0 < (c[1969] | 0) >>> 0) oa();
     b = h + 16 | 0;
     if ((c[b >> 2] | 0) == (q | 0)) c[b >> 2] = p; else c[h + 20 >> 2] = p;
     if (!p) break;
    }
    d = c[1969] | 0;
    if (p >>> 0 < d >>> 0) oa();
    c[p + 24 >> 2] = h;
    b = c[a + (o + 8) >> 2] | 0;
    do if (b) if (b >>> 0 < d >>> 0) oa(); else {
     c[p + 16 >> 2] = b;
     c[b + 24 >> 2] = p;
     break;
    } while (0);
    b = c[a + (o + 12) >> 2] | 0;
    if (b) if (b >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
     c[p + 20 >> 2] = b;
     c[b + 24 >> 2] = p;
     break;
    }
   }
  } while (0);
  c[u + 4 >> 2] = g | 1;
  c[u + g >> 2] = g;
  if ((u | 0) == (c[1970] | 0)) {
   c[1967] = g;
   return;
  }
 } else {
  c[b >> 2] = d & -2;
  c[u + 4 >> 2] = g | 1;
  c[u + g >> 2] = g;
 }
 b = g >>> 3;
 if (g >>> 0 < 256) {
  d = b << 1;
  f = 7900 + (d << 2) | 0;
  e = c[1965] | 0;
  b = 1 << b;
  if (!(e & b)) {
   c[1965] = e | b;
   r = 7900 + (d + 2 << 2) | 0;
   s = f;
  } else {
   b = 7900 + (d + 2 << 2) | 0;
   d = c[b >> 2] | 0;
   if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    r = b;
    s = d;
   }
  }
  c[r >> 2] = u;
  c[s + 12 >> 2] = u;
  c[u + 8 >> 2] = s;
  c[u + 12 >> 2] = f;
  return;
 }
 b = g >>> 8;
 if (!b) f = 0; else if (g >>> 0 > 16777215) f = 31; else {
  r = (b + 1048320 | 0) >>> 16 & 8;
  s = b << r;
  q = (s + 520192 | 0) >>> 16 & 4;
  s = s << q;
  f = (s + 245760 | 0) >>> 16 & 2;
  f = 14 - (q | r | f) + (s << f >>> 15) | 0;
  f = g >>> (f + 7 | 0) & 1 | f << 1;
 }
 b = 8164 + (f << 2) | 0;
 c[u + 28 >> 2] = f;
 c[u + 20 >> 2] = 0;
 c[u + 16 >> 2] = 0;
 d = c[1966] | 0;
 e = 1 << f;
 a : do if (!(d & e)) {
  c[1966] = d | e;
  c[b >> 2] = u;
  c[u + 24 >> 2] = b;
  c[u + 12 >> 2] = u;
  c[u + 8 >> 2] = u;
 } else {
  b = c[b >> 2] | 0;
  b : do if ((c[b + 4 >> 2] & -8 | 0) == (g | 0)) t = b; else {
   f = g << ((f | 0) == 31 ? 0 : 25 - (f >>> 1) | 0);
   while (1) {
    d = b + 16 + (f >>> 31 << 2) | 0;
    e = c[d >> 2] | 0;
    if (!e) break;
    if ((c[e + 4 >> 2] & -8 | 0) == (g | 0)) {
     t = e;
     break b;
    } else {
     f = f << 1;
     b = e;
    }
   }
   if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    c[d >> 2] = u;
    c[u + 24 >> 2] = b;
    c[u + 12 >> 2] = u;
    c[u + 8 >> 2] = u;
    break a;
   }
  } while (0);
  b = t + 8 | 0;
  d = c[b >> 2] | 0;
  s = c[1969] | 0;
  if (d >>> 0 >= s >>> 0 & t >>> 0 >= s >>> 0) {
   c[d + 12 >> 2] = u;
   c[b >> 2] = u;
   c[u + 8 >> 2] = d;
   c[u + 12 >> 2] = t;
   c[u + 24 >> 2] = 0;
   break;
  } else oa();
 } while (0);
 u = (c[1973] | 0) + -1 | 0;
 c[1973] = u;
 if (!u) b = 8316; else return;
 while (1) {
  b = c[b >> 2] | 0;
  if (!b) break; else b = b + 8 | 0;
 }
 c[1973] = -1;
 return;
}

function Bd() {
 var b = 0, e = 0, f = 0;
 c[273] = 0;
 c[364] = 0;
 c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
 c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
 while (1) {
  if ((c[365] | 0) >= (c[366] | 0)) break;
  if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 123) {
   if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 125) {
    Gc(c[367] | 0);
    c[365] = (c[365] | 0) + 1;
    continue;
   }
   if ((c[273] | 0) == (c[14] | 0)) xb();
   a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[273] = (c[273] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
   continue;
  }
  c[364] = (c[364] | 0) + 1;
  c[365] = (c[365] | 0) + 1;
  c[370] = c[365];
  c[371] = 0;
  c[372] = 0;
  c[373] = 0;
  c[374] = 1;
  while (1) {
   if (c[373] | 0) break;
   if ((c[365] | 0) >= (c[366] | 0)) break;
   b = c[365] | 0;
   if ((d[8613 + (d[(c[64] | 0) + (c[365] | 0) >> 0] | 0) >> 0] | 0 | 0) != 2) {
    if ((d[(c[64] | 0) + b >> 0] | 0 | 0) == 125) {
     c[364] = (c[364] | 0) - 1;
     c[365] = (c[365] | 0) + 1;
     c[373] = 1;
     continue;
    }
    if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 123) {
     c[364] = (c[364] | 0) + 1;
     c[365] = (c[365] | 0) + 1;
     yd();
     continue;
    } else {
     c[365] = (c[365] | 0) + 1;
     continue;
    }
   }
   c[365] = b + 1;
   if (c[371] | 0) {
    zd();
    c[374] = 0;
   } else {
    a : do switch (d[(c[64] | 0) + ((c[365] | 0) - 1) >> 0] | 0 | 0) {
    case 70:
    case 102:
     {
      c[376] = c[375];
      c[378] = c[377];
      if ((c[376] | 0) == (c[378] | 0)) c[374] = 0;
      if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 102) if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 70) break a;
      c[372] = 1;
      break;
     }
    case 86:
    case 118:
     {
      c[376] = c[363];
      c[378] = c[362];
      if ((c[376] | 0) == (c[378] | 0)) c[374] = 0;
      if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 118) if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 86) break a;
      c[372] = 1;
      break;
     }
    case 76:
    case 108:
     {
      c[376] = c[362];
      c[378] = c[361];
      if ((c[376] | 0) == (c[378] | 0)) c[374] = 0;
      if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 108) if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 76) break a;
      c[372] = 1;
      break;
     }
    case 74:
    case 106:
     {
      c[376] = c[361];
      c[378] = c[379];
      if ((c[376] | 0) == (c[378] | 0)) c[374] = 0;
      if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 106) if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 74) break a;
      c[372] = 1;
      break;
     }
    default:
     {
      zd();
      c[374] = 0;
     }
    } while (0);
    if (c[372] | 0) c[365] = (c[365] | 0) + 1;
   }
   c[371] = 1;
  }
  if (!((c[373] | 0) != 0 & (c[374] | 0) != 0)) continue;
  c[345] = c[273];
  c[365] = c[370];
  c[364] = 1;
  while (1) {
   if ((c[364] | 0) <= 0) break;
   b = c[365] | 0;
   if (!((c[364] | 0) == 1 ? (d[8613 + (d[(c[64] | 0) + (c[365] | 0) >> 0] | 0) >> 0] | 0 | 0) == 2 : 0)) {
    if ((d[(c[64] | 0) + b >> 0] | 0 | 0) == 125) {
     c[364] = (c[364] | 0) - 1;
     c[365] = (c[365] | 0) + 1;
     if ((c[364] | 0) <= 0) continue;
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 125;
     c[273] = (c[273] | 0) + 1;
     continue;
    }
    if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 123) {
     c[364] = (c[364] | 0) + 1;
     c[365] = (c[365] | 0) + 1;
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 123;
     c[273] = (c[273] | 0) + 1;
     continue;
    } else {
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     c[365] = (c[365] | 0) + 1;
     continue;
    }
   }
   c[365] = b + 1;
   if (c[372] | 0) c[365] = (c[365] | 0) + 1;
   c[380] = 1;
   c[381] = c[365];
   if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 123) {
    c[380] = 0;
    c[364] = (c[364] | 0) + 1;
    c[365] = (c[365] | 0) + 1;
    c[370] = c[365];
    yd();
    c[381] = (c[365] | 0) - 1;
   }
   b : while (1) {
    if ((c[376] | 0) >= (c[378] | 0)) break;
    b = (c[372] | 0) != 0;
    c[357] = c[(c[19] | 0) + (c[376] << 2) >> 2];
    c[358] = c[(c[19] | 0) + ((c[376] | 0) + 1 << 2) >> 2];
    c : do if (b) {
     if (((c[355] | 0) + ((c[358] | 0) - (c[357] | 0)) | 0) > (c[14] | 0)) xb();
     while (1) {
      if ((c[357] | 0) >= (c[358] | 0)) break c;
      a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[16] | 0) + (c[357] | 0) >> 0] | 0;
      c[273] = (c[273] | 0) + 1;
      c[357] = (c[357] | 0) + 1;
     }
    } else {
     while (1) {
      if ((c[357] | 0) >= (c[358] | 0)) break c;
      if ((d[8613 + (d[(c[16] | 0) + (c[357] | 0) >> 0] | 0) >> 0] | 0 | 0) == 2) {
       e = 56;
       break;
      }
      if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 123) if (((c[357] | 0) + 1 | 0) < (c[358] | 0)) if ((d[(c[16] | 0) + ((c[357] | 0) + 1) >> 0] | 0 | 0) == 92) break;
      c[357] = (c[357] | 0) + 1;
     }
     if ((e | 0) == 56) {
      e = 0;
      if ((c[273] | 0) == (c[14] | 0)) xb();
      a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[16] | 0) + (c[357] | 0) >> 0] | 0;
      c[273] = (c[273] | 0) + 1;
      break;
     }
     if (((c[273] | 0) + 2 | 0) > (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 123;
     c[273] = (c[273] | 0) + 1;
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 92;
     c[273] = (c[273] | 0) + 1;
     c[357] = (c[357] | 0) + 2;
     c[356] = 1;
     while (1) {
      if (!((c[357] | 0) < (c[358] | 0) ? (c[356] | 0) > 0 : 0)) break c;
      if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 125) c[356] = (c[356] | 0) - 1; else if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 123) c[356] = (c[356] | 0) + 1;
      if ((c[273] | 0) == (c[14] | 0)) xb();
      a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[16] | 0) + (c[357] | 0) >> 0] | 0;
      c[273] = (c[273] | 0) + 1;
      c[357] = (c[357] | 0) + 1;
     }
    } while (0);
    c[376] = (c[376] | 0) + 1;
    if ((c[376] | 0) >= (c[378] | 0)) continue;
    if (!(c[380] | 0)) {
     if (((c[355] | 0) + ((c[381] | 0) - (c[370] | 0)) | 0) > (c[14] | 0)) xb();
     c[365] = c[370];
     while (1) {
      if ((c[365] | 0) >= (c[381] | 0)) continue b;
      a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
      c[273] = (c[273] | 0) + 1;
      c[365] = (c[365] | 0) + 1;
     }
    }
    if (!(c[372] | 0)) {
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 46;
     c[273] = (c[273] | 0) + 1;
    }
    if ((d[8613 + (d[(c[20] | 0) + (c[376] | 0) >> 0] | 0) >> 0] | 0 | 0) == 4) {
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[20] | 0) + (c[376] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     continue;
    }
    if ((c[376] | 0) != ((c[378] | 0) - 1 | 0)) if (Ad(3) | 0) {
     if ((c[273] | 0) == (c[14] | 0)) xb();
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 32;
     c[273] = (c[273] | 0) + 1;
     continue;
    }
    if ((c[273] | 0) == (c[14] | 0)) xb();
    a[(c[17] | 0) + (c[273] | 0) >> 0] = 126;
    c[273] = (c[273] | 0) + 1;
   }
   if (c[380] | 0) continue;
   c[365] = (c[381] | 0) + 1;
  }
  if ((c[273] | 0) <= 0) continue;
  if ((d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0 | 0) != 126) continue;
  c[273] = (c[273] | 0) - 1;
  if ((d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0 | 0) == 126) continue;
  f = (Ad(3) | 0) != 0;
  b = c[273] | 0;
  if (f) {
   a[(c[17] | 0) + b >> 0] = 32;
   c[273] = (c[273] | 0) + 1;
   continue;
  } else {
   c[273] = b + 1;
   continue;
  }
 }
 if ((c[364] | 0) <= 0) {
  f = c[273] | 0;
  c[355] = f;
  return;
 }
 Gc(c[367] | 0);
 f = c[273] | 0;
 c[355] = f;
 return;
}

function Gj(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 q = a + b | 0;
 d = c[a + 4 >> 2] | 0;
 do if (!(d & 1)) {
  k = c[a >> 2] | 0;
  if (!(d & 3)) return;
  n = a + (0 - k) | 0;
  m = k + b | 0;
  j = c[1969] | 0;
  if (n >>> 0 < j >>> 0) oa();
  if ((n | 0) == (c[1970] | 0)) {
   e = a + (b + 4) | 0;
   d = c[e >> 2] | 0;
   if ((d & 3 | 0) != 3) {
    t = n;
    h = m;
    break;
   }
   c[1967] = m;
   c[e >> 2] = d & -2;
   c[a + (4 - k) >> 2] = m | 1;
   c[q >> 2] = m;
   return;
  }
  g = k >>> 3;
  if (k >>> 0 < 256) {
   f = c[a + (8 - k) >> 2] | 0;
   e = c[a + (12 - k) >> 2] | 0;
   d = 7900 + (g << 1 << 2) | 0;
   if ((f | 0) != (d | 0)) {
    if (f >>> 0 < j >>> 0) oa();
    if ((c[f + 12 >> 2] | 0) != (n | 0)) oa();
   }
   if ((e | 0) == (f | 0)) {
    c[1965] = c[1965] & ~(1 << g);
    t = n;
    h = m;
    break;
   }
   if ((e | 0) == (d | 0)) i = e + 8 | 0; else {
    if (e >>> 0 < j >>> 0) oa();
    d = e + 8 | 0;
    if ((c[d >> 2] | 0) == (n | 0)) i = d; else oa();
   }
   c[f + 12 >> 2] = e;
   c[i >> 2] = f;
   t = n;
   h = m;
   break;
  }
  i = c[a + (24 - k) >> 2] | 0;
  f = c[a + (12 - k) >> 2] | 0;
  do if ((f | 0) == (n | 0)) {
   f = 16 - k | 0;
   e = a + (f + 4) | 0;
   d = c[e >> 2] | 0;
   if (!d) {
    e = a + f | 0;
    d = c[e >> 2] | 0;
    if (!d) {
     l = 0;
     break;
    }
   }
   while (1) {
    f = d + 20 | 0;
    g = c[f >> 2] | 0;
    if (g) {
     d = g;
     e = f;
     continue;
    }
    f = d + 16 | 0;
    g = c[f >> 2] | 0;
    if (!g) break; else {
     d = g;
     e = f;
    }
   }
   if (e >>> 0 < j >>> 0) oa(); else {
    c[e >> 2] = 0;
    l = d;
    break;
   }
  } else {
   g = c[a + (8 - k) >> 2] | 0;
   if (g >>> 0 < j >>> 0) oa();
   d = g + 12 | 0;
   if ((c[d >> 2] | 0) != (n | 0)) oa();
   e = f + 8 | 0;
   if ((c[e >> 2] | 0) == (n | 0)) {
    c[d >> 2] = f;
    c[e >> 2] = g;
    l = f;
    break;
   } else oa();
  } while (0);
  if (!i) {
   t = n;
   h = m;
  } else {
   d = c[a + (28 - k) >> 2] | 0;
   e = 8164 + (d << 2) | 0;
   if ((n | 0) == (c[e >> 2] | 0)) {
    c[e >> 2] = l;
    if (!l) {
     c[1966] = c[1966] & ~(1 << d);
     t = n;
     h = m;
     break;
    }
   } else {
    if (i >>> 0 < (c[1969] | 0) >>> 0) oa();
    d = i + 16 | 0;
    if ((c[d >> 2] | 0) == (n | 0)) c[d >> 2] = l; else c[i + 20 >> 2] = l;
    if (!l) {
     t = n;
     h = m;
     break;
    }
   }
   f = c[1969] | 0;
   if (l >>> 0 < f >>> 0) oa();
   c[l + 24 >> 2] = i;
   d = 16 - k | 0;
   e = c[a + d >> 2] | 0;
   do if (e) if (e >>> 0 < f >>> 0) oa(); else {
    c[l + 16 >> 2] = e;
    c[e + 24 >> 2] = l;
    break;
   } while (0);
   d = c[a + (d + 4) >> 2] | 0;
   if (!d) {
    t = n;
    h = m;
   } else if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    c[l + 20 >> 2] = d;
    c[d + 24 >> 2] = l;
    t = n;
    h = m;
    break;
   }
  }
 } else {
  t = a;
  h = b;
 } while (0);
 j = c[1969] | 0;
 if (q >>> 0 < j >>> 0) oa();
 d = a + (b + 4) | 0;
 e = c[d >> 2] | 0;
 if (!(e & 2)) {
  if ((q | 0) == (c[1971] | 0)) {
   s = (c[1968] | 0) + h | 0;
   c[1968] = s;
   c[1971] = t;
   c[t + 4 >> 2] = s | 1;
   if ((t | 0) != (c[1970] | 0)) return;
   c[1970] = 0;
   c[1967] = 0;
   return;
  }
  if ((q | 0) == (c[1970] | 0)) {
   s = (c[1967] | 0) + h | 0;
   c[1967] = s;
   c[1970] = t;
   c[t + 4 >> 2] = s | 1;
   c[t + s >> 2] = s;
   return;
  }
  h = (e & -8) + h | 0;
  g = e >>> 3;
  do if (e >>> 0 < 256) {
   f = c[a + (b + 8) >> 2] | 0;
   e = c[a + (b + 12) >> 2] | 0;
   d = 7900 + (g << 1 << 2) | 0;
   if ((f | 0) != (d | 0)) {
    if (f >>> 0 < j >>> 0) oa();
    if ((c[f + 12 >> 2] | 0) != (q | 0)) oa();
   }
   if ((e | 0) == (f | 0)) {
    c[1965] = c[1965] & ~(1 << g);
    break;
   }
   if ((e | 0) == (d | 0)) o = e + 8 | 0; else {
    if (e >>> 0 < j >>> 0) oa();
    d = e + 8 | 0;
    if ((c[d >> 2] | 0) == (q | 0)) o = d; else oa();
   }
   c[f + 12 >> 2] = e;
   c[o >> 2] = f;
  } else {
   i = c[a + (b + 24) >> 2] | 0;
   f = c[a + (b + 12) >> 2] | 0;
   do if ((f | 0) == (q | 0)) {
    e = a + (b + 20) | 0;
    d = c[e >> 2] | 0;
    if (!d) {
     e = a + (b + 16) | 0;
     d = c[e >> 2] | 0;
     if (!d) {
      p = 0;
      break;
     }
    }
    while (1) {
     f = d + 20 | 0;
     g = c[f >> 2] | 0;
     if (g) {
      d = g;
      e = f;
      continue;
     }
     f = d + 16 | 0;
     g = c[f >> 2] | 0;
     if (!g) break; else {
      d = g;
      e = f;
     }
    }
    if (e >>> 0 < j >>> 0) oa(); else {
     c[e >> 2] = 0;
     p = d;
     break;
    }
   } else {
    g = c[a + (b + 8) >> 2] | 0;
    if (g >>> 0 < j >>> 0) oa();
    d = g + 12 | 0;
    if ((c[d >> 2] | 0) != (q | 0)) oa();
    e = f + 8 | 0;
    if ((c[e >> 2] | 0) == (q | 0)) {
     c[d >> 2] = f;
     c[e >> 2] = g;
     p = f;
     break;
    } else oa();
   } while (0);
   if (i) {
    d = c[a + (b + 28) >> 2] | 0;
    e = 8164 + (d << 2) | 0;
    if ((q | 0) == (c[e >> 2] | 0)) {
     c[e >> 2] = p;
     if (!p) {
      c[1966] = c[1966] & ~(1 << d);
      break;
     }
    } else {
     if (i >>> 0 < (c[1969] | 0) >>> 0) oa();
     d = i + 16 | 0;
     if ((c[d >> 2] | 0) == (q | 0)) c[d >> 2] = p; else c[i + 20 >> 2] = p;
     if (!p) break;
    }
    e = c[1969] | 0;
    if (p >>> 0 < e >>> 0) oa();
    c[p + 24 >> 2] = i;
    d = c[a + (b + 16) >> 2] | 0;
    do if (d) if (d >>> 0 < e >>> 0) oa(); else {
     c[p + 16 >> 2] = d;
     c[d + 24 >> 2] = p;
     break;
    } while (0);
    d = c[a + (b + 20) >> 2] | 0;
    if (d) if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
     c[p + 20 >> 2] = d;
     c[d + 24 >> 2] = p;
     break;
    }
   }
  } while (0);
  c[t + 4 >> 2] = h | 1;
  c[t + h >> 2] = h;
  if ((t | 0) == (c[1970] | 0)) {
   c[1967] = h;
   return;
  }
 } else {
  c[d >> 2] = e & -2;
  c[t + 4 >> 2] = h | 1;
  c[t + h >> 2] = h;
 }
 d = h >>> 3;
 if (h >>> 0 < 256) {
  e = d << 1;
  g = 7900 + (e << 2) | 0;
  f = c[1965] | 0;
  d = 1 << d;
  if (!(f & d)) {
   c[1965] = f | d;
   r = 7900 + (e + 2 << 2) | 0;
   s = g;
  } else {
   d = 7900 + (e + 2 << 2) | 0;
   e = c[d >> 2] | 0;
   if (e >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    r = d;
    s = e;
   }
  }
  c[r >> 2] = t;
  c[s + 12 >> 2] = t;
  c[t + 8 >> 2] = s;
  c[t + 12 >> 2] = g;
  return;
 }
 d = h >>> 8;
 if (!d) g = 0; else if (h >>> 0 > 16777215) g = 31; else {
  r = (d + 1048320 | 0) >>> 16 & 8;
  s = d << r;
  q = (s + 520192 | 0) >>> 16 & 4;
  s = s << q;
  g = (s + 245760 | 0) >>> 16 & 2;
  g = 14 - (q | r | g) + (s << g >>> 15) | 0;
  g = h >>> (g + 7 | 0) & 1 | g << 1;
 }
 d = 8164 + (g << 2) | 0;
 c[t + 28 >> 2] = g;
 c[t + 20 >> 2] = 0;
 c[t + 16 >> 2] = 0;
 e = c[1966] | 0;
 f = 1 << g;
 if (!(e & f)) {
  c[1966] = e | f;
  c[d >> 2] = t;
  c[t + 24 >> 2] = d;
  c[t + 12 >> 2] = t;
  c[t + 8 >> 2] = t;
  return;
 }
 d = c[d >> 2] | 0;
 a : do if ((c[d + 4 >> 2] & -8 | 0) != (h | 0)) {
  g = h << ((g | 0) == 31 ? 0 : 25 - (g >>> 1) | 0);
  while (1) {
   e = d + 16 + (g >>> 31 << 2) | 0;
   f = c[e >> 2] | 0;
   if (!f) break;
   if ((c[f + 4 >> 2] & -8 | 0) == (h | 0)) {
    d = f;
    break a;
   } else {
    g = g << 1;
    d = f;
   }
  }
  if (e >>> 0 < (c[1969] | 0) >>> 0) oa();
  c[e >> 2] = t;
  c[t + 24 >> 2] = d;
  c[t + 12 >> 2] = t;
  c[t + 8 >> 2] = t;
  return;
 } while (0);
 e = d + 8 | 0;
 f = c[e >> 2] | 0;
 s = c[1969] | 0;
 if (!(f >>> 0 >= s >>> 0 & d >>> 0 >= s >>> 0)) oa();
 c[f + 12 >> 2] = t;
 c[e >> 2] = t;
 c[t + 8 >> 2] = f;
 c[t + 12 >> 2] = d;
 c[t + 24 >> 2] = 0;
 return;
}

function Bi(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0;
 w = i;
 i = i + 1056 | 0;
 u = w + 1024 | 0;
 v = w;
 k = a[e >> 0] | 0;
 do if (k << 24 >> 24) {
  t = ui(b, k << 24 >> 24) | 0;
  if (!t) b = 0; else {
   j = a[e + 1 >> 0] | 0;
   if (!(j << 24 >> 24)) b = t; else {
    f = t + 1 | 0;
    m = a[f >> 0] | 0;
    if (!(m << 24 >> 24)) b = 0; else {
     h = a[e + 2 >> 0] | 0;
     if (!(h << 24 >> 24)) {
      k = j & 255 | (k & 255) << 8;
      b = m;
      j = t;
      g = d[t >> 0] << 8 | m & 255;
      while (1) {
       h = g & 65535;
       if ((h | 0) == (k | 0)) {
        f = j;
        break;
       }
       b = f + 1 | 0;
       g = a[b >> 0] | 0;
       if (!(g << 24 >> 24)) {
        b = 0;
        break;
       } else {
        j = f;
        f = b;
        b = g;
        g = g & 255 | h << 8;
       }
      }
      b = b << 24 >> 24 != 0 ? f : 0;
      break;
     }
     f = t + 2 | 0;
     l = a[f >> 0] | 0;
     if (!(l << 24 >> 24)) b = 0; else {
      g = a[e + 3 >> 0] | 0;
      if (!(g << 24 >> 24)) {
       h = (j & 255) << 16 | (k & 255) << 24 | (h & 255) << 8;
       b = (l & 255) << 8 | (m & 255) << 16 | d[t >> 0] << 24;
       if ((b | 0) == (h | 0)) b = l; else {
        g = b;
        do {
         f = f + 1 | 0;
         b = a[f >> 0] | 0;
         g = (b & 255 | g) << 8;
        } while (!(b << 24 >> 24 == 0 | (g | 0) == (h | 0)));
       }
       b = b << 24 >> 24 != 0 ? f + -2 | 0 : 0;
       break;
      }
      f = t + 3 | 0;
      b = a[f >> 0] | 0;
      if (!(b << 24 >> 24)) b = 0; else {
       if (!(a[e + 4 >> 0] | 0)) {
        h = (j & 255) << 16 | (k & 255) << 24 | (h & 255) << 8 | g & 255;
        g = (l & 255) << 8 | (m & 255) << 16 | b & 255 | d[t >> 0] << 24;
        if ((g | 0) != (h | 0)) do {
         f = f + 1 | 0;
         b = a[f >> 0] | 0;
         g = b & 255 | g << 8;
        } while (!(b << 24 >> 24 == 0 | (g | 0) == (h | 0)));
        b = b << 24 >> 24 != 0 ? f + -3 | 0 : 0;
        break;
       };
       c[u >> 2] = 0;
       c[u + 4 >> 2] = 0;
       c[u + 8 >> 2] = 0;
       c[u + 12 >> 2] = 0;
       c[u + 16 >> 2] = 0;
       c[u + 20 >> 2] = 0;
       c[u + 24 >> 2] = 0;
       c[u + 28 >> 2] = 0;
       b = k;
       g = 0;
       while (1) {
        if (!(a[t + g >> 0] | 0)) {
         b = 0;
         break;
        }
        f = u + (((b & 255) >>> 5 & 255) << 2) | 0;
        c[f >> 2] = c[f >> 2] | 1 << (b & 31);
        f = g + 1 | 0;
        c[v + ((b & 255) << 2) >> 2] = f;
        b = a[e + f >> 0] | 0;
        if (!(b << 24 >> 24)) {
         n = 23;
         break;
        } else g = f;
       }
       a : do if ((n | 0) == 23) {
        b : do if (f >>> 0 > 1) {
         h = 1;
         n = -1;
         b = 0;
         c : while (1) {
          m = 1;
          while (1) {
           d : while (1) {
            j = 1;
            while (1) {
             k = a[e + (j + n) >> 0] | 0;
             l = a[e + h >> 0] | 0;
             if (k << 24 >> 24 != l << 24 >> 24) {
              m = h;
              j = k;
              h = l;
              break d;
             }
             if ((j | 0) == (m | 0)) break;
             j = j + 1 | 0;
             h = j + b | 0;
             if (h >>> 0 >= f >>> 0) {
              b = n;
              p = m;
              break c;
             }
            }
            b = b + m | 0;
            h = b + 1 | 0;
            if (h >>> 0 >= f >>> 0) {
             b = n;
             p = m;
             break c;
            }
           }
           k = m - n | 0;
           if ((j & 255) <= (h & 255)) break;
           b = m + 1 | 0;
           if (b >>> 0 < f >>> 0) {
            h = b;
            b = m;
            m = k;
           } else {
            b = n;
            p = k;
            break c;
           }
          }
          h = b + 2 | 0;
          if (h >>> 0 >= f >>> 0) {
           p = 1;
           break;
          } else {
           n = b;
           b = b + 1 | 0;
          }
         }
         j = 1;
         k = -1;
         h = 0;
         while (1) {
          l = h;
          h = 1;
          while (1) {
           o = l;
           e : while (1) {
            l = 1;
            while (1) {
             n = a[e + (l + k) >> 0] | 0;
             m = a[e + j >> 0] | 0;
             if (n << 24 >> 24 != m << 24 >> 24) {
              l = j;
              j = o;
              break e;
             }
             if ((l | 0) == (h | 0)) break;
             l = l + 1 | 0;
             j = l + o | 0;
             if (j >>> 0 >= f >>> 0) {
              j = p;
              break b;
             }
            }
            o = o + h | 0;
            j = o + 1 | 0;
            if (j >>> 0 >= f >>> 0) {
             j = p;
             break b;
            }
           }
           h = l - k | 0;
           if ((n & 255) >= (m & 255)) {
            h = j;
            break;
           }
           j = l + 1 | 0;
           if (j >>> 0 >= f >>> 0) {
            j = p;
            break b;
           }
          }
          j = h + 2 | 0;
          if (j >>> 0 >= f >>> 0) {
           k = h;
           j = p;
           h = 1;
           break;
          } else {
           k = h;
           h = h + 1 | 0;
          }
         }
        } else {
         b = -1;
         k = -1;
         j = 1;
         h = 1;
        } while (0);
        r = (k + 1 | 0) >>> 0 > (b + 1 | 0) >>> 0;
        h = r ? h : j;
        r = r ? k : b;
        q = r + 1 | 0;
        if (!(wi(e, e + h | 0, q) | 0)) s = f - h | 0; else {
         h = f - r + -1 | 0;
         s = 0;
         h = (r >>> 0 > h >>> 0 ? r : h) + 1 | 0;
        }
        n = f | 63;
        o = (s | 0) != 0;
        p = f - h | 0;
        b = t;
        m = 0;
        l = t;
        f : while (1) {
         j = b;
         do if ((l - j | 0) >>> 0 < f >>> 0) {
          k = ti(l, 0, n) | 0;
          if (!k) {
           k = l + n | 0;
           break;
          } else if ((k - j | 0) >>> 0 < f >>> 0) {
           b = 0;
           break a;
          } else break;
         } else k = l; while (0);
         j = a[b + g >> 0] | 0;
         if (!(1 << (j & 31) & c[u + (((j & 255) >>> 5 & 255) << 2) >> 2])) {
          b = b + f | 0;
          m = 0;
          l = k;
          continue;
         }
         t = c[v + ((j & 255) << 2) >> 2] | 0;
         j = f - t | 0;
         if ((f | 0) != (t | 0)) {
          b = b + (o & (m | 0) != 0 & j >>> 0 < h >>> 0 ? p : j) | 0;
          m = 0;
          l = k;
          continue;
         }
         j = q >>> 0 > m >>> 0 ? q : m;
         l = a[e + j >> 0] | 0;
         g : do if (!(l << 24 >> 24)) j = q; else {
          while (1) {
           if (l << 24 >> 24 != (a[b + j >> 0] | 0)) break;
           j = j + 1 | 0;
           l = a[e + j >> 0] | 0;
           if (!(l << 24 >> 24)) {
            j = q;
            break g;
           }
          }
          b = b + (j - r) | 0;
          m = 0;
          l = k;
          continue f;
         } while (0);
         do {
          if (j >>> 0 <= m >>> 0) break a;
          j = j + -1 | 0;
         } while ((a[e + j >> 0] | 0) == (a[b + j >> 0] | 0));
         b = b + h | 0;
         m = s;
         l = k;
        }
       } while (0);
      }
     }
    }
   }
  }
 } while (0);
 i = w;
 return b | 0;
}

function Me() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0;
 u = i;
 i = i + 80 | 0;
 t = u;
 r = u + 64 | 0;
 s = u + 60 | 0;
 b = u + 56 | 0;
 e = u + 52 | 0;
 j = u + 48 | 0;
 k = u + 44 | 0;
 l = u + 40 | 0;
 m = u + 36 | 0;
 n = u + 32 | 0;
 o = u + 28 | 0;
 p = u + 24 | 0;
 q = u + 20 | 0;
 f = u + 16 | 0;
 g = u + 12 | 0;
 h = u + 8 | 0;
 c[718] = 0;
 if (79 >= (c[14] | 0)) c[718] = ((c[718] | 0) * 10 | 0) + 3;
 if ((c[262] | 0) < 128) c[718] = ((c[718] | 0) * 10 | 0) + 4;
 if ((c[262] | 0) > (c[267] | 0)) c[718] = ((c[718] | 0) * 10 | 0) + 5;
 if ((c[23] | 0) > (c[267] | 0)) c[718] = ((c[718] | 0) * 10 | 0) + 7;
 if ((c[120] | 0) > (c[23] | 0)) c[718] = ((c[718] | 0) * 10 | 0) + 8;
 if ((c[718] | 0) > 0) {
  v = c[12] | 0;
  c[t >> 2] = c[718];
  c[t + 4 >> 2] = 15362;
  $i(v, 15355, t) | 0;
  $e(1);
 }
 a[8356] = 0;
 a[8901] = 32;
 a[8902] = 33;
 a[8903] = 34;
 a[8904] = 35;
 a[8905] = 36;
 a[8906] = 37;
 a[8907] = 38;
 a[8908] = 39;
 a[8909] = 40;
 a[8910] = 41;
 a[8911] = 42;
 a[8912] = 43;
 a[8913] = 44;
 a[8914] = 45;
 a[8915] = 46;
 a[8916] = 47;
 a[8917] = 48;
 a[8918] = 49;
 a[8919] = 50;
 a[8920] = 51;
 a[8921] = 52;
 a[8922] = 53;
 a[8923] = 54;
 a[8924] = 55;
 a[8925] = 56;
 a[8926] = 57;
 a[8927] = 58;
 a[8928] = 59;
 a[8929] = 60;
 a[8930] = 61;
 a[8931] = 62;
 a[8932] = 63;
 a[8933] = 64;
 a[8934] = 65;
 a[8935] = 66;
 a[8936] = 67;
 a[8937] = 68;
 a[8938] = 69;
 a[8939] = 70;
 a[8940] = 71;
 a[8941] = 72;
 a[8942] = 73;
 a[8943] = 74;
 a[8944] = 75;
 a[8945] = 76;
 a[8946] = 77;
 a[8947] = 78;
 a[8948] = 79;
 a[8949] = 80;
 a[8950] = 81;
 a[8951] = 82;
 a[8952] = 83;
 a[8953] = 84;
 a[8954] = 85;
 a[8955] = 86;
 a[8956] = 87;
 a[8957] = 88;
 a[8958] = 89;
 a[8959] = 90;
 a[8960] = 91;
 a[8961] = 92;
 a[8962] = 93;
 a[8963] = 94;
 a[8964] = 95;
 a[8965] = 96;
 a[8966] = 97;
 a[8967] = 98;
 a[8968] = 99;
 a[8969] = 100;
 a[8970] = 101;
 a[8971] = 102;
 a[8972] = 103;
 a[8973] = 104;
 a[8974] = 105;
 a[8975] = 106;
 a[8976] = 107;
 a[8977] = 108;
 a[8978] = 109;
 a[8979] = 110;
 a[8980] = 111;
 a[8981] = 112;
 a[8982] = 113;
 a[8983] = 114;
 a[8984] = 115;
 a[8985] = 116;
 a[8986] = 117;
 a[8987] = 118;
 a[8988] = 119;
 a[8989] = 120;
 a[8990] = 121;
 a[8991] = 122;
 a[8992] = 123;
 a[8993] = 124;
 a[8994] = 125;
 a[8995] = 126;
 a[8869] = 32;
 a[8996] = 32;
 c[r >> 2] = 0;
 c[b >> 2] = 31;
 if ((c[r >> 2] | 0) <= (c[b >> 2] | 0)) do {
  a[8869 + (c[r >> 2] | 0) >> 0] = c[r >> 2];
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[b >> 2] | 0));
 c[r >> 2] = 127;
 c[e >> 2] = 255;
 if ((c[r >> 2] | 0) <= (c[e >> 2] | 0)) do {
  a[8869 + (c[r >> 2] | 0) >> 0] = c[r >> 2];
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[e >> 2] | 0));
 c[r >> 2] = 0;
 c[j >> 2] = 255;
 if ((c[r >> 2] | 0) <= (c[j >> 2] | 0)) do {
  a[8357 + (d[8869 + (c[r >> 2] | 0) >> 0] | 0) >> 0] = c[r >> 2];
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[j >> 2] | 0));
 c[r >> 2] = 0;
 c[k >> 2] = 127;
 if ((c[r >> 2] | 0) <= (c[k >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 5;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[k >> 2] | 0));
 c[r >> 2] = 128;
 c[l >> 2] = 255;
 if ((c[r >> 2] | 0) <= (c[l >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 2;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[l >> 2] | 0));
 c[r >> 2] = 0;
 c[m >> 2] = 31;
 if ((c[r >> 2] | 0) <= (c[m >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 0;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[m >> 2] | 0));
 a[8740] = 0;
 a[8622] = 1;
 a[8626] = 1;
 a[8645] = 1;
 a[8739] = 4;
 a[8658] = 4;
 c[r >> 2] = 48;
 c[n >> 2] = 57;
 if ((c[r >> 2] | 0) <= (c[n >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 3;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[n >> 2] | 0));
 c[r >> 2] = 65;
 c[o >> 2] = 90;
 if ((c[r >> 2] | 0) <= (c[o >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 2;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[o >> 2] | 0));
 c[r >> 2] = 97;
 c[p >> 2] = 122;
 if ((c[r >> 2] | 0) <= (c[p >> 2] | 0)) do {
  a[8613 + (c[r >> 2] | 0) >> 0] = 2;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[p >> 2] | 0));
 c[r >> 2] = 0;
 c[q >> 2] = 255;
 if ((c[r >> 2] | 0) <= (c[q >> 2] | 0)) do {
  a[9126 + (c[r >> 2] | 0) >> 0] = 1;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[q >> 2] | 0));
 c[r >> 2] = 0;
 c[f >> 2] = 31;
 if ((c[r >> 2] | 0) <= (c[f >> 2] | 0)) do {
  a[9126 + (c[r >> 2] | 0) >> 0] = 0;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[f >> 2] | 0));
 a[9158] = 0;
 a[9135] = 0;
 a[9160] = 0;
 a[9161] = 0;
 a[9163] = 0;
 a[9165] = 0;
 a[9166] = 0;
 a[9167] = 0;
 a[9170] = 0;
 a[9187] = 0;
 a[9249] = 0;
 a[9251] = 0;
 c[r >> 2] = 0;
 c[g >> 2] = 127;
 if ((c[r >> 2] | 0) <= (c[g >> 2] | 0)) do {
  c[1640 + (c[r >> 2] << 2) >> 2] = 0;
  v = c[r >> 2] | 0;
  c[r >> 2] = v + 1;
 } while ((v | 0) < (c[g >> 2] | 0));
 c[442] = 278;
 c[443] = 278;
 c[444] = 500;
 c[445] = 833;
 c[446] = 500;
 c[447] = 833;
 c[448] = 778;
 c[449] = 278;
 c[450] = 389;
 c[451] = 389;
 c[452] = 500;
 c[453] = 778;
 c[454] = 278;
 c[455] = 333;
 c[456] = 278;
 c[457] = 500;
 c[458] = 500;
 c[459] = 500;
 c[460] = 500;
 c[461] = 500;
 c[462] = 500;
 c[463] = 500;
 c[464] = 500;
 c[465] = 500;
 c[466] = 500;
 c[467] = 500;
 c[468] = 278;
 c[469] = 278;
 c[470] = 278;
 c[471] = 778;
 c[472] = 472;
 c[473] = 472;
 c[474] = 778;
 c[475] = 750;
 c[476] = 708;
 c[477] = 722;
 c[478] = 764;
 c[479] = 681;
 c[480] = 653;
 c[481] = 785;
 c[482] = 750;
 c[483] = 361;
 c[484] = 514;
 c[485] = 778;
 c[486] = 625;
 c[487] = 917;
 c[488] = 750;
 c[489] = 778;
 c[490] = 681;
 c[491] = 778;
 c[492] = 736;
 c[493] = 556;
 c[494] = 722;
 c[495] = 750;
 c[496] = 750;
 c[497] = 1028;
 c[498] = 750;
 c[499] = 750;
 c[500] = 611;
 c[501] = 278;
 c[502] = 500;
 c[503] = 278;
 c[504] = 500;
 c[505] = 278;
 c[506] = 278;
 c[507] = 500;
 c[508] = 556;
 c[509] = 444;
 c[510] = 556;
 c[511] = 444;
 c[512] = 306;
 c[513] = 500;
 c[514] = 556;
 c[515] = 278;
 c[516] = 306;
 c[517] = 528;
 c[518] = 278;
 c[519] = 833;
 c[520] = 556;
 c[521] = 500;
 c[522] = 556;
 c[523] = 528;
 c[524] = 392;
 c[525] = 394;
 c[526] = 389;
 c[527] = 556;
 c[528] = 528;
 c[529] = 722;
 c[530] = 528;
 c[531] = 528;
 c[532] = 444;
 c[533] = 500;
 c[534] = 1e3;
 c[535] = 500;
 c[536] = 500;
 c[s >> 2] = 1;
 c[h >> 2] = c[717];
 if ((c[s >> 2] | 0) <= (c[h >> 2] | 0)) do {
  c[(c[265] | 0) + (c[s >> 2] << 2) >> 2] = 0;
  c[(c[167] | 0) + (c[s >> 2] << 2) >> 2] = 0;
  v = c[s >> 2] | 0;
  c[s >> 2] = v + 1;
 } while ((v | 0) < (c[h >> 2] | 0));
 c[266] = (c[717] | 0) + 1;
 c[259] = 0;
 c[22] = 1;
 c[(c[63] | 0) + (c[22] << 2) >> 2] = c[259];
 c[115] = 0;
 c[688] = 0;
 c[118] = 0;
 c[690] = 0;
 c[172] = 0;
 c[692] = 0;
 c[350] = 0;
 c[180] = 0;
 c[390] = 0;
 c[277] = 0;
 c[269] = 0;
 c[394] = 0;
 while (1) {
  if ((c[394] | 0) >= (c[716] | 0)) break;
  c[(c[395] | 0) + (c[394] << 2) >> 2] = 0;
  c[(c[398] | 0) + (c[394] << 2) >> 2] = 0;
  c[394] = (c[394] | 0) + 1;
 }
 c[715] = 0;
 c[696] = 0;
 c[697] = 0;
 c[706] = 0;
 c[707] = 0;
 c[714] = 0;
 c[334] = 0;
 c[175] = 0;
 Zc();
 oe();
 i = u;
 return;
}

function Fe() {
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 h = i;
 i = i + 48 | 0;
 d = h + 40 | 0;
 f = h + 32 | 0;
 e = h + 16 | 0;
 b = h;
 if (c[697] | 0) {
  Qi(14918, c[11] | 0) | 0;
  Qi(14918, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[697] = 1;
 if (!(c[696] | 0)) {
  Qi(14948, c[11] | 0) | 0;
  Qi(14948, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[704] = c[67];
 c[705] = c[21];
 c[274] = c[704];
 while (1) {
  if ((c[274] | 0) >= (c[705] | 0)) break;
  a[(c[16] | 0) + (c[274] | 0) >> 0] = a[(c[15] | 0) + (c[274] | 0) >> 0] | 0;
  c[274] = (c[274] | 0) + 1;
 }
 jc(_(c[269] | 0, c[179] | 0) | 0);
 c[173] = 0;
 while (1) {
  if ((c[173] | 0) >= (c[170] | 0)) break;
  c[(c[171] | 0) + (c[173] << 2) >> 2] = 0;
  c[173] = (c[173] | 0) + 1;
 }
 c[172] = 0;
 while (1) {
  if ((c[172] | 0) >= (c[120] | 0)) break;
  c[(c[122] | 0) + (c[172] << 2) >> 2] = 0;
  c[(c[124] | 0) + (c[172] << 2) >> 2] = 0;
  c[172] = (c[172] | 0) + 1;
 }
 c[351] = c[179];
 if (c[350] | 0) {
  c[172] = c[693];
  while (1) {
   if ((c[172] | 0) >= (c[351] | 0)) break;
   c[(c[124] | 0) + (c[172] << 2) >> 2] = c[(c[121] | 0) + (c[172] << 2) >> 2];
   c[(c[123] | 0) + (c[172] << 2) >> 2] = 0;
   c[172] = (c[172] | 0) + 1;
  }
  c[172] = c[693];
 } else {
  c[172] = c[179];
  c[693] = 0;
 }
 c[706] = 1;
 c[115] = 0;
 while (1) {
  if ((c[115] | 0) >= (c[695] | 0)) break;
  j = (c[691] | 0) != 0;
  k = c[11] | 0;
  l = (c[115] | 0) + 1 | 0;
  c[b >> 2] = 14991;
  c[b + 4 >> 2] = l;
  c[b + 8 >> 2] = 14096;
  $i(k, 9764, b) | 0;
  if (j) {
   l = c[12] | 0;
   k = (c[115] | 0) + 1 | 0;
   c[e >> 2] = 14991;
   c[e + 4 >> 2] = k;
   c[e + 8 >> 2] = 14096;
   $i(l, 9764, e) | 0;
   Pb();
  } else Qb();
  c[168] = 0;
  c[67] = c[21];
  while (1) {
   if (!((Oe(c[(c[338] | 0) + (c[115] << 2) >> 2] | 0) | 0) != 0 ^ 1)) break;
   Ee();
  }
  We(c[(c[338] | 0) + (c[115] << 2) >> 2] | 0);
  c[115] = (c[115] | 0) + 1;
 }
 c[707] = 1;
 c[179] = c[172];
 c[407] = c[326];
 l = _((c[179] | 0) - 1 | 0, c[269] | 0) | 0;
 if ((l + (c[327] | 0) | 0) >= (c[170] | 0)) {
  Qi(12809, c[11] | 0) | 0;
  Qi(12809, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 }
 c[172] = 0;
 while (1) {
  if ((c[172] | 0) >= (c[179] | 0)) break;
  l = _(c[172] | 0, c[269] | 0) | 0;
  c[173] = l + (c[327] | 0);
  a : do if (c[(c[171] | 0) + (c[173] << 2) >> 2] | 0) if (Uc(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0) | 0) {
   c[270] = c[(c[271] | 0) + (c[272] << 2) >> 2];
   c[(c[171] | 0) + (c[173] << 2) >> 2] = c[(c[167] | 0) + (c[270] << 2) >> 2];
   c[708] = c[(c[271] | 0) + (c[270] << 2) >> 2];
   l = _(c[172] | 0, c[269] | 0) | 0;
   c[173] = l + (c[328] | 0);
   c[709] = (c[173] | 0) - (c[328] | 0) + (c[269] | 0);
   l = _(c[708] | 0, c[269] | 0) | 0;
   c[710] = l + (c[328] | 0);
   while (1) {
    if ((c[173] | 0) >= (c[709] | 0)) break a;
    if (!(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0)) c[(c[171] | 0) + (c[173] << 2) >> 2] = c[(c[171] | 0) + (c[710] << 2) >> 2];
    c[173] = (c[173] | 0) + 1;
    c[710] = (c[710] | 0) + 1;
   }
  } while (0);
  c[172] = (c[172] | 0) + 1;
 }
 l = _((c[179] | 0) - 1 | 0, c[269] | 0) | 0;
 if ((l + (c[327] | 0) | 0) >= (c[170] | 0)) {
  Qi(12809, c[11] | 0) | 0;
  Qi(12809, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 }
 c[172] = 0;
 while (1) {
  if ((c[172] | 0) >= (c[179] | 0)) break;
  l = _(c[172] | 0, c[269] | 0) | 0;
  c[173] = l + (c[327] | 0);
  do if (c[(c[171] | 0) + (c[173] << 2) >> 2] | 0) {
   if (!(Uc(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0) | 0)) {
    if (c[276] | 0) Tb();
    uc();
    c[(c[171] | 0) + (c[173] << 2) >> 2] = 0;
    break;
   }
   if ((c[270] | 0) != (c[(c[271] | 0) + (c[272] << 2) >> 2] | 0)) Tb();
   c[708] = c[(c[271] | 0) + (c[270] << 2) >> 2];
   if (!(c[(c[122] | 0) + (c[708] << 2) >> 2] | 0)) {
    uc();
    c[(c[171] | 0) + (c[173] << 2) >> 2] = 0;
    break;
   }
   l = _(c[708] | 0, c[269] | 0) | 0;
   c[710] = l + (c[327] | 0);
   if (c[(c[171] | 0) + (c[710] << 2) >> 2] | 0) {
    Qi(15007, c[11] | 0) | 0;
    Qi(15007, c[12] | 0) | 0;
    tc(c[(c[121] | 0) + (c[708] << 2) >> 2] | 0);
    l = c[11] | 0;
    c[f >> 2] = 15047;
    $i(l, 16602, f) | 0;
    l = c[12] | 0;
    c[d >> 2] = 15047;
    $i(l, 16602, d) | 0;
    sb();
   }
   if (!(c[350] | 0)) if ((c[708] | 0) >= (c[351] | 0)) if ((c[(c[124] | 0) + (c[708] << 2) >> 2] | 0) < (c[711] | 0)) c[(c[171] | 0) + (c[173] << 2) >> 2] = 0;
  } while (0);
  c[172] = (c[172] | 0) + 1;
 }
 c[172] = 0;
 b : while (1) {
  if ((c[172] | 0) >= (c[179] | 0)) break;
  do if (!(c[(c[122] | 0) + (c[172] << 2) >> 2] | 0)) vc(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0); else {
   if (!(c[350] | 0)) if ((c[172] | 0) >= (c[351] | 0)) if ((c[(c[124] | 0) + (c[172] << 2) >> 2] | 0) < (c[711] | 0)) break;
   c : do if ((c[172] | 0) > (c[712] | 0)) {
    l = _((c[712] | 0) + 1 | 0, c[269] | 0) | 0;
    if ((l | 0) > (c[170] | 0)) {
     g = 70;
     break b;
    }
    c[(c[121] | 0) + (c[712] << 2) >> 2] = c[(c[121] | 0) + (c[172] << 2) >> 2];
    c[(c[122] | 0) + (c[712] << 2) >> 2] = c[(c[122] | 0) + (c[172] << 2) >> 2];
    if (!(Uc(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0) | 0)) sc();
    if (c[276] | 0) {
     if ((c[270] | 0) != (c[(c[271] | 0) + (c[272] << 2) >> 2] | 0)) g = 75;
    } else g = 75;
    if ((g | 0) == 75) {
     g = 0;
     Tb();
    }
    c[(c[271] | 0) + (c[270] << 2) >> 2] = c[712];
    c[173] = _(c[712] | 0, c[269] | 0) | 0;
    c[709] = (c[173] | 0) + (c[269] | 0);
    c[274] = _(c[172] | 0, c[269] | 0) | 0;
    while (1) {
     if ((c[173] | 0) >= (c[709] | 0)) break c;
     c[(c[171] | 0) + (c[173] << 2) >> 2] = c[(c[171] | 0) + (c[274] << 2) >> 2];
     c[173] = (c[173] | 0) + 1;
     c[274] = (c[274] | 0) + 1;
    }
   } while (0);
   c[712] = (c[712] | 0) + 1;
  } while (0);
  c[172] = (c[172] | 0) + 1;
 }
 if ((g | 0) == 70) {
  Qi(12809, c[11] | 0) | 0;
  Qi(12809, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 }
 c[179] = c[712];
 d : do if (c[350] | 0) {
  c[172] = c[693];
  while (1) {
   if ((c[172] | 0) >= (c[351] | 0)) break d;
   if (!(c[(c[123] | 0) + (c[172] << 2) >> 2] | 0)) vc(c[(c[124] | 0) + (c[172] << 2) >> 2] | 0);
   c[172] = (c[172] | 0) + 1;
  }
 } while (0);
 c[391] = kh((_((c[390] | 0) + 1 | 0, (c[179] | 0) + 1 | 0) | 0) << 2) | 0;
 c[713] = 0;
 while (1) {
  if ((c[713] | 0) >= (_(c[390] | 0, c[179] | 0) | 0)) break;
  c[(c[391] | 0) + (c[713] << 2) >> 2] = 0;
  c[713] = (c[713] | 0) + 1;
 }
 l = _((c[277] | 0) + 1 | 0, (c[179] | 0) + 1 | 0) | 0;
 c[280] = kh(_(l, (c[279] | 0) + 1 | 0) | 0) | 0;
 c[392] = 0;
 while (1) {
  if ((c[392] | 0) >= (_(c[277] | 0, c[179] | 0) | 0)) break;
  l = (_(c[392] | 0, (c[279] | 0) + 1 | 0) | 0) + 0 | 0;
  a[(c[280] | 0) + l >> 0] = 127;
  c[392] = (c[392] | 0) + 1;
 }
 c[172] = 0;
 while (1) {
  if ((c[172] | 0) >= (c[179] | 0)) break;
  c[(c[124] | 0) + (c[172] << 2) >> 2] = c[172];
  c[172] = (c[172] | 0) + 1;
 }
 c[714] = 1;
 c[67] = c[704];
 c[21] = c[705];
 c[274] = c[67];
 while (1) {
  if ((c[274] | 0) >= (c[21] | 0)) break;
  a[(c[15] | 0) + (c[274] | 0) >> 0] = a[(c[16] | 0) + (c[274] | 0) >> 0] | 0;
  c[274] = (c[274] | 0) + 1;
 }
 i = h;
 return;
}

function ne(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 32 | 0;
 e = m + 12 | 0;
 h = m + 8 | 0;
 j = m + 4 | 0;
 f = m + 17 | 0;
 g = m + 16 | 0;
 k = m;
 c[e >> 2] = b;
 do switch (d[(c[166] | 0) + (c[e >> 2] | 0) >> 0] | 0 | 0) {
 case 0:
  {
   c[732 + (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] << 2) >> 2] = (c[732 + (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] << 2) >> 2] | 0) + 1;
   do switch (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0) {
   case 0:
    {
     Md();
     i = m;
     return;
    }
   case 1:
    {
     Nd();
     i = m;
     return;
    }
   case 2:
    {
     Od();
     i = m;
     return;
    }
   case 3:
    {
     Pd();
     i = m;
     return;
    }
   case 4:
    {
     Qd();
     i = m;
     return;
    }
   case 5:
    {
     Rd();
     i = m;
     return;
    }
   case 6:
    {
     Sd();
     i = m;
     return;
    }
   case 7:
    {
     Td();
     i = m;
     return;
    }
   case 8:
    {
     if (!(c[174] | 0)) {
      yc();
      i = m;
      return;
     }
     if ((c[(c[122] | 0) + (c[172] << 2) >> 2] | 0) == (c[408] | 0)) {
      ne(c[325] | 0);
      i = m;
      return;
     }
     if (!(c[(c[122] | 0) + (c[172] << 2) >> 2] | 0)) {
      i = m;
      return;
     }
     ne(c[(c[122] | 0) + (c[172] << 2) >> 2] | 0);
     i = m;
     return;
    }
   case 9:
    {
     Ud();
     i = m;
     return;
    }
   case 10:
    {
     Vd();
     i = m;
     return;
    }
   case 11:
    {
     Wd();
     i = m;
     return;
    }
   case 12:
    {
     Xd();
     i = m;
     return;
    }
   case 13:
    {
     Yd();
     i = m;
     return;
    }
   case 14:
    {
     Zd();
     i = m;
     return;
    }
   case 15:
    {
     Dd(1468, 9384);
     Dd(1548, 9385);
     Dd(1600, 9387);
     if ((d[9384] | 0 | 0) != 2) {
      Ed(c[367] | 0, a[9384] | 0, 2);
      i = m;
      return;
     }
     if ((d[9385] | 0 | 0) != 2) {
      Ed(c[387] | 0, a[9385] | 0, 2);
      i = m;
      return;
     }
     e = c[400] | 0;
     if (d[9387] | 0) {
      Ed(e, a[9387] | 0, 0);
      i = m;
      return;
     }
     if ((e | 0) > 0) {
      ne(c[387] | 0);
      i = m;
      return;
     } else {
      ne(c[367] | 0);
      i = m;
      return;
     }
    }
   case 16:
    {
     _d();
     i = m;
     return;
    }
   case 17:
    {
     $d();
     i = m;
     return;
    }
   case 18:
    {
     ae();
     i = m;
     return;
    }
   case 19:
    {
     Dc();
     i = m;
     return;
    }
   case 20:
    {
     be();
     i = m;
     return;
    }
   case 21:
    {
     Dd(1468, 9384);
     i = m;
     return;
    }
   case 22:
    {
     ce();
     i = m;
     return;
    }
   case 23:
    {
     de();
     i = m;
     return;
    }
   case 24:
    {
     ee();
     i = m;
     return;
    }
   case 26:
    {
     Gd();
     i = m;
     return;
    }
   case 27:
    {
     fe();
     i = m;
     return;
    }
   case 28:
    {
     ge();
     i = m;
     return;
    }
   case 29:
    {
     he();
     i = m;
     return;
    }
   case 30:
    {
     ie();
     i = m;
     return;
    }
   case 31:
    {
     Fd();
     i = m;
     return;
    }
   case 32:
    {
     je();
     i = m;
     return;
    }
   case 33:
    {
     ke();
     i = m;
     return;
    }
   case 34:
    {
     Dd(h, f);
     Dd(j, g);
     if ((d[f >> 0] | 0 | 0) != 2) {
      Ed(c[h >> 2] | 0, a[f >> 0] | 0, 2);
      i = m;
      return;
     }
     if ((d[g >> 0] | 0 | 0) != 2) {
      Ed(c[j >> 2] | 0, a[g >> 0] | 0, 2);
      i = m;
      return;
     }
     while (1) {
      ne(c[j >> 2] | 0);
      Dd(1468, 9384);
      e = c[367] | 0;
      if (d[9384] | 0) break;
      if ((e | 0) <= 0) {
       l = 94;
       break;
      }
      ne(c[h >> 2] | 0);
     }
     if ((l | 0) == 94) {
      i = m;
      return;
     }
     Ed(e, a[9384] | 0, 0);
     i = m;
     return;
    }
   case 35:
    {
     le();
     i = m;
     return;
    }
   case 36:
    {
     me();
     i = m;
     return;
    }
   case 25:
    {
     i = m;
     return;
    }
   default:
    {
     Qi(13643, c[11] | 0) | 0;
     Qi(13643, c[12] | 0) | 0;
     wb();
     xa(96, 1);
    }
   } while (0);
   break;
  }
 case 1:
  {
   c[k >> 2] = c[(c[271] | 0) + (c[e >> 2] << 2) >> 2];
   while (1) {
    if ((c[(c[337] | 0) + (c[k >> 2] << 2) >> 2] | 0) == (c[335] | 0)) break;
    e = c[k >> 2] | 0;
    if (c[(c[337] | 0) + (c[k >> 2] << 2) >> 2] | 0) ne(c[(c[337] | 0) + (e << 2) >> 2] | 0); else {
     c[k >> 2] = e + 1;
     Cd(c[(c[337] | 0) + (c[k >> 2] << 2) >> 2] | 0, 2);
    }
    c[k >> 2] = (c[k >> 2] | 0) + 1;
   }
   i = m;
   return;
  }
 case 2:
  {
   Cd(c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0, 0);
   i = m;
   return;
  }
 case 3:
  {
   Cd(c[(c[167] | 0) + (c[e >> 2] << 2) >> 2] | 0, 1);
   i = m;
   return;
  }
 case 4:
  {
   if (!(c[174] | 0)) {
    yc();
    i = m;
    return;
   }
   l = _(c[172] | 0, c[269] | 0) | 0;
   c[173] = l + (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0);
   if ((c[173] | 0) >= (c[170] | 0)) {
    Qi(12809, c[11] | 0) | 0;
    Qi(12809, c[12] | 0) | 0;
    wb();
    xa(96, 1);
   }
   if (!(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0)) {
    Cd(c[(c[167] | 0) + (c[e >> 2] << 2) >> 2] | 0, 3);
    i = m;
    return;
   } else {
    Cd(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0, 1);
    i = m;
    return;
   }
  }
 case 5:
  if (c[174] | 0) {
   l = _(c[172] | 0, c[390] | 0) | 0;
   Cd(c[(c[391] | 0) + (l + (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0) << 2) >> 2] | 0, 0);
   i = m;
   return;
  } else {
   yc();
   i = m;
   return;
  }
 case 6:
  {
   if (!(c[174] | 0)) {
    yc();
    i = m;
    return;
   }
   l = _(c[172] | 0, c[277] | 0) | 0;
   c[392] = l + (c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0);
   c[273] = 0;
   while (1) {
    l = _(c[392] | 0, (c[279] | 0) + 1 | 0) | 0;
    if ((d[(c[280] | 0) + (l + (c[273] | 0)) >> 0] | 0 | 0) == 127) break;
    l = _(c[392] | 0, (c[279] | 0) + 1 | 0) | 0;
    a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[280] | 0) + (l + (c[273] | 0)) >> 0] | 0;
    c[273] = (c[273] | 0) + 1;
   }
   c[355] = c[273];
   Jd();
   i = m;
   return;
  }
 case 7:
  {
   Cd(c[(c[271] | 0) + (c[e >> 2] << 2) >> 2] | 0, 0);
   i = m;
   return;
  }
 case 8:
  {
   c[394] = c[(c[271] | 0) + (c[e >> 2] << 2) >> 2];
   if ((c[(c[395] | 0) + (c[394] << 2) >> 2] | 0) > 0) {
    Cd(c[(c[395] | 0) + (c[394] << 2) >> 2] | 0, 1);
    i = m;
    return;
   }
   while (1) {
    if (((c[259] | 0) + (c[(c[398] | 0) + (c[394] << 2) >> 2] | 0) | 0) <= (c[65] | 0)) break;
    Bb();
   }
   c[396] = 0;
   while (1) {
    if ((c[396] | 0) >= (c[(c[398] | 0) + (c[394] << 2) >> 2] | 0)) break;
    l = _(c[394] | 0, (c[329] | 0) + 1 | 0) | 0;
    a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[397] | 0) + (l + (c[396] | 0)) >> 0] | 0;
    c[259] = (c[259] | 0) + 1;
    c[396] = (c[396] | 0) + 1;
   }
   Cd(Lc() | 0, 1);
   i = m;
   return;
  }
 default:
  {
   $b();
   i = m;
   return;
  }
 } while (0);
}

function Zd() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 128 | 0;
 m = n + 112 | 0;
 l = n + 96 | 0;
 k = n + 80 | 0;
 j = n + 64 | 0;
 f = n + 48 | 0;
 h = n + 32 | 0;
 g = n + 16 | 0;
 e = n;
 Dd(1468, 9384);
 Dd(1548, 9385);
 Dd(1600, 9387);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  i = n;
  return;
 }
 if (d[9385] | 0) {
  Ed(c[387] | 0, a[9385] | 0, 0);
  Cd(c[323] | 0, 1);
  i = n;
  return;
 }
 if ((d[9387] | 0 | 0) != 1) {
  Ed(c[400] | 0, a[9387] | 0, 1);
  Cd(c[323] | 0, 1);
  i = n;
  return;
 }
 c[355] = 0;
 Kd(c[400] | 0);
 c[273] = 0;
 c[401] = 0;
 while (1) {
  if ((c[401] | 0) >= (c[387] | 0)) break;
  if ((c[273] | 0) >= (c[355] | 0)) break;
  c[401] = (c[401] | 0) + 1;
  c[345] = c[273];
  vd(c[400] | 0);
 }
 if ((c[273] | 0) < (c[355] | 0)) c[273] = (c[273] | 0) - 4;
 if ((c[401] | 0) < (c[387] | 0)) {
  b = c[11] | 0;
  if ((c[387] | 0) == 1) {
   Qi(13449, b) | 0;
   Qi(13449, c[12] | 0) | 0;
  } else {
   o = c[387] | 0;
   c[e >> 2] = 13471;
   c[e + 4 >> 2] = o;
   c[e + 8 >> 2] = 13485;
   $i(b, 9764, e) | 0;
   e = c[12] | 0;
   b = c[387] | 0;
   c[g >> 2] = 13471;
   c[g + 4 >> 2] = b;
   c[g + 8 >> 2] = 13485;
   $i(e, 9764, g) | 0;
  }
  Ab(c[400] | 0);
  Vi(34, c[11] | 0) | 0;
  Vi(34, c[12] | 0) | 0;
  wc();
 }
 a : while (1) {
  if ((c[273] | 0) <= (c[345] | 0)) break;
  switch (d[8613 + (d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0) >> 0] | 0 | 0) {
  case 4:
  case 1:
   {
    c[273] = (c[273] | 0) - 1;
    continue a;
   }
  default:
   {}
  }
  if ((d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0 | 0) != 44) break;
  o = c[11] | 0;
  g = c[387] | 0;
  c[h >> 2] = 13497;
  c[h + 4 >> 2] = g;
  c[h + 8 >> 2] = 13503;
  $i(o, 9764, h) | 0;
  o = c[12] | 0;
  g = c[387] | 0;
  c[f >> 2] = 13497;
  c[f + 4 >> 2] = g;
  c[f + 8 >> 2] = 13503;
  $i(o, 9764, f) | 0;
  Ab(c[400] | 0);
  Qi(13509, c[11] | 0) | 0;
  Qi(13509, c[12] | 0) | 0;
  wc();
  c[273] = (c[273] | 0) - 1;
 }
 c[357] = 0;
 c[402] = 0;
 c[403] = 0;
 c[404] = 1;
 b : while (1) {
  if ((c[345] | 0) >= (c[273] | 0)) break;
  switch (d[(c[17] | 0) + (c[345] | 0) >> 0] | 0 | 0) {
  case 44:
   {
    if ((c[402] | 0) == 2) {
     o = c[11] | 0;
     h = c[387] | 0;
     c[j >> 2] = 13534;
     c[j + 4 >> 2] = h;
     c[j + 8 >> 2] = 13559;
     $i(o, 9764, j) | 0;
     o = c[12] | 0;
     h = c[387] | 0;
     c[k >> 2] = 13534;
     c[k + 4 >> 2] = h;
     c[k + 8 >> 2] = 13559;
     $i(o, 9764, k) | 0;
     Ab(c[400] | 0);
     Vi(34, c[11] | 0) | 0;
     Vi(34, c[12] | 0) | 0;
     wc();
    } else {
     c[402] = (c[402] | 0) + 1;
     b = c[403] | 0;
     if ((c[402] | 0) == 1) c[405] = b; else c[406] = b;
     a[(c[20] | 0) + (c[403] | 0) >> 0] = 44;
    }
    c[345] = (c[345] | 0) + 1;
    c[404] = 1;
    continue b;
   }
  case 123:
   {
    c[352] = (c[352] | 0) + 1;
    if (c[404] | 0) {
     c[(c[19] | 0) + (c[403] << 2) >> 2] = c[357];
     c[403] = (c[403] | 0) + 1;
    }
    a[(c[16] | 0) + (c[357] | 0) >> 0] = a[(c[17] | 0) + (c[345] | 0) >> 0] | 0;
    c[357] = (c[357] | 0) + 1;
    c[345] = (c[345] | 0) + 1;
    while (1) {
     if ((c[352] | 0) <= 0) break;
     if ((c[345] | 0) >= (c[273] | 0)) break;
     if ((d[(c[17] | 0) + (c[345] | 0) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; else if ((d[(c[17] | 0) + (c[345] | 0) >> 0] | 0 | 0) == 123) c[352] = (c[352] | 0) + 1;
     a[(c[16] | 0) + (c[357] | 0) >> 0] = a[(c[17] | 0) + (c[345] | 0) >> 0] | 0;
     c[357] = (c[357] | 0) + 1;
     c[345] = (c[345] | 0) + 1;
    }
    c[404] = 0;
    continue b;
   }
  case 125:
   {
    if (c[404] | 0) {
     c[(c[19] | 0) + (c[403] << 2) >> 2] = c[357];
     c[403] = (c[403] | 0) + 1;
    }
    o = c[11] | 0;
    h = c[387] | 0;
    c[l >> 2] = 13497;
    c[l + 4 >> 2] = h;
    c[l + 8 >> 2] = 13559;
    $i(o, 9764, l) | 0;
    o = c[12] | 0;
    h = c[387] | 0;
    c[m >> 2] = 13497;
    c[m + 4 >> 2] = h;
    c[m + 8 >> 2] = 13559;
    $i(o, 9764, m) | 0;
    Ab(c[400] | 0);
    Qi(13565, c[11] | 0) | 0;
    Qi(13565, c[12] | 0) | 0;
    wc();
    c[345] = (c[345] | 0) + 1;
    c[404] = 0;
    continue b;
   }
  default:
   switch (d[8613 + (d[(c[17] | 0) + (c[345] | 0) >> 0] | 0) >> 0] | 0 | 0) {
   case 1:
    {
     if (!(c[404] | 0)) a[(c[20] | 0) + (c[403] | 0) >> 0] = 32;
     c[345] = (c[345] | 0) + 1;
     c[404] = 1;
     continue b;
    }
   case 4:
    {
     if (!(c[404] | 0)) a[(c[20] | 0) + (c[403] | 0) >> 0] = a[(c[17] | 0) + (c[345] | 0) >> 0] | 0;
     c[345] = (c[345] | 0) + 1;
     c[404] = 1;
     continue b;
    }
   default:
    {
     if (c[404] | 0) {
      c[(c[19] | 0) + (c[403] << 2) >> 2] = c[357];
      c[403] = (c[403] | 0) + 1;
     }
     a[(c[16] | 0) + (c[357] | 0) >> 0] = a[(c[17] | 0) + (c[345] | 0) >> 0] | 0;
     c[357] = (c[357] | 0) + 1;
     c[345] = (c[345] | 0) + 1;
     c[404] = 0;
     continue b;
    }
   }
  }
 }
 c[(c[19] | 0) + (c[403] << 2) >> 2] = c[357];
 do if (!(c[402] | 0)) {
  c[375] = 0;
  c[361] = c[403];
  c[379] = c[361];
  c[363] = 0;
  while (1) {
   if ((c[363] | 0) >= ((c[361] | 0) - 1 | 0)) {
    b = 63;
    break;
   }
   c[357] = c[(c[19] | 0) + (c[363] << 2) >> 2];
   c[358] = c[(c[19] | 0) + ((c[363] | 0) + 1 << 2) >> 2];
   if (wd() | 0) {
    b = 61;
    break;
   }
   c[363] = (c[363] | 0) + 1;
  }
  if ((b | 0) == 61) xd(); else if ((b | 0) == 63) {
   while (1) {
    if ((c[363] | 0) <= 0) break;
    if ((d[8613 + (d[(c[20] | 0) + (c[363] | 0) >> 0] | 0) >> 0] | 0 | 0) != 4) break;
    if ((d[(c[20] | 0) + (c[363] | 0) >> 0] | 0 | 0) == 126) break;
    c[363] = (c[363] | 0) - 1;
    b = 63;
   }
   c[362] = c[363];
  }
  c[377] = c[363];
 } else {
  if ((c[402] | 0) == 1) {
   c[363] = 0;
   c[361] = c[405];
   c[379] = c[361];
   c[375] = c[379];
   c[377] = c[403];
   xd();
   break;
  }
  if ((c[402] | 0) == 2) {
   c[363] = 0;
   c[361] = c[405];
   c[379] = c[406];
   c[375] = c[379];
   c[377] = c[403];
   xd();
   break;
  } else {
   Qi(13588, c[11] | 0) | 0;
   Qi(13588, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
 } while (0);
 c[355] = 0;
 Kd(c[367] | 0);
 Bd();
 Jd();
 i = n;
 return;
}

function hf(b, d, e, f, g) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 var h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0;
 C = i;
 i = i + 96 | 0;
 k = C;
 m = C + 80 | 0;
 h = C + 76 | 0;
 n = C + 72 | 0;
 o = C + 68 | 0;
 p = C + 64 | 0;
 y = C + 60 | 0;
 u = C + 56 | 0;
 r = C + 52 | 0;
 q = C + 48 | 0;
 v = C + 44 | 0;
 t = C + 40 | 0;
 s = C + 36 | 0;
 z = C + 32 | 0;
 A = C + 28 | 0;
 w = C + 24 | 0;
 j = C + 20 | 0;
 l = C + 16 | 0;
 x = C + 12 | 0;
 c[m >> 2] = b;
 c[h >> 2] = d;
 c[n >> 2] = e;
 c[o >> 2] = f;
 c[p >> 2] = g;
 c[v >> 2] = 0;
 c[t >> 2] = 0;
 c[s >> 2] = 0;
 c[z >> 2] = 0;
 if ((c[n >> 2] | 0) == 3 | (c[n >> 2] | 0) == 0 | (c[n >> 2] | 0) == 1) g = 1; else g = (c[n >> 2] | 0) == 20;
 c[A >> 2] = g & 1;
 c[w >> 2] = 0;
 if (!(c[h >> 2] | 0)) za(19621, 19632, 1028, 19690);
 if (!(c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 4 >> 2] | 0)) ef(c[m >> 2] | 0, c[n >> 2] | 0) | 0;
 if (c[(c[m >> 2] | 0) + 44 >> 2] & 32) {
  Qi(29466, c[1840] | 0) | 0;
  f = c[1840] | 0;
  e = c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) >> 2] | 0;
  b = c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 12 >> 2] | 0;
  c[k >> 2] = c[h >> 2];
  c[k + 4 >> 2] = e;
  c[k + 8 >> 2] = b;
  $i(f, 19717, k) | 0;
  ij(c[1840] | 0) | 0;
 }
 c[u >> 2] = Sf(c[m >> 2] | 0, c[h >> 2] | 0) | 0;
 c[z >> 2] = $g(c[m >> 2] | 0, 19772) | 0;
 c[s >> 2] = ri(c[u >> 2] | 0, 46) | 0;
 if (c[s >> 2] | 0) {
  c[j >> 2] = ui(c[s >> 2] | 0, 47) | 0;
  if (c[j >> 2] | 0) c[s >> 2] = 0;
 }
 c[v >> 2] = si(c[u >> 2] | 0) | 0;
 a : do if (c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 32 >> 2] | 0) {
  c[r >> 2] = c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 32 >> 2];
  while (1) {
   if (c[t >> 2] | 0) break a;
   if (!(c[c[r >> 2] >> 2] | 0)) break a;
   c[l >> 2] = si(c[c[r >> 2] >> 2] | 0) | 0;
   if ((c[v >> 2] | 0) >>> 0 >= (c[l >> 2] | 0) >>> 0) if (c[c[r >> 2] >> 2] | 0) if ((c[u >> 2] | 0) + (c[v >> 2] | 0) + (0 - (c[l >> 2] | 0)) | 0) g = (Ci(c[c[r >> 2] >> 2] | 0, (c[u >> 2] | 0) + (c[v >> 2] | 0) + (0 - (c[l >> 2] | 0)) | 0) | 0) == 0; else g = 0; else g = 0; else g = 0;
   c[t >> 2] = g & 1;
   c[r >> 2] = (c[r >> 2] | 0) + 4;
  }
 } while (0);
 b : do if (!(c[t >> 2] | 0)) if (c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 36 >> 2] | 0) {
  c[r >> 2] = c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 36 >> 2];
  while (1) {
   if (c[t >> 2] | 0) break b;
   if (!(c[c[r >> 2] >> 2] | 0)) break b;
   c[x >> 2] = si(c[c[r >> 2] >> 2] | 0) | 0;
   if ((c[v >> 2] | 0) >>> 0 >= (c[x >> 2] | 0) >>> 0) if (c[c[r >> 2] >> 2] | 0) if ((c[u >> 2] | 0) + (c[v >> 2] | 0) + (0 - (c[x >> 2] | 0)) | 0) g = (Ci(c[c[r >> 2] >> 2] | 0, (c[u >> 2] | 0) + (c[v >> 2] | 0) + (0 - (c[x >> 2] | 0)) | 0) | 0) == 0; else g = 0; else g = 0; else g = 0;
   c[t >> 2] = g & 1;
   c[r >> 2] = (c[r >> 2] | 0) + 4;
  }
 } while (0);
 c[q >> 2] = 0;
 c[y >> 2] = kh(4) | 0;
 do if (c[s >> 2] | 0) {
  if (c[z >> 2] | 0) if ((a[c[z >> 2] >> 0] | 0) != 102) if ((a[c[z >> 2] >> 0] | 0) != 48) {
   B = 36;
   break;
  }
  tf(c[m >> 2] | 0, y, q, c[n >> 2] | 0, c[u >> 2] | 0, c[A >> 2] | 0, c[t >> 2] | 0, c[s >> 2] | 0);
  uf(c[m >> 2] | 0, y, q, c[n >> 2] | 0, c[u >> 2] | 0, c[A >> 2] | 0, c[t >> 2] | 0);
 } else B = 36; while (0);
 if ((B | 0) == 36) {
  uf(c[m >> 2] | 0, y, q, c[n >> 2] | 0, c[u >> 2] | 0, c[A >> 2] | 0, c[t >> 2] | 0);
  tf(c[m >> 2] | 0, y, q, c[n >> 2] | 0, c[u >> 2] | 0, c[A >> 2] | 0, c[t >> 2] | 0, c[s >> 2] | 0);
 }
 c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] = 0;
 if (c[z >> 2] | 0) Cj(c[z >> 2] | 0);
 c[w >> 2] = pg(c[m >> 2] | 0, c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 4 >> 2] | 0, c[y >> 2] | 0, 0, c[p >> 2] | 0) | 0;
 if ((c[o >> 2] | 0) != 0 ? (c[c[w >> 2] >> 2] | 0) == 0 : 0) {
  c[q >> 2] = 0;
  while (1) {
   if (!(c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] | 0)) break;
   Cj(c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] | 0);
   c[q >> 2] = (c[q >> 2] | 0) + 1;
  }
  c[q >> 2] = 0;
  c : do if (!(c[t >> 2] | 0)) if (c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 40 >> 2] | 0) {
   c[r >> 2] = c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 32 >> 2];
   while (1) {
    if (!(c[c[r >> 2] >> 2] | 0)) break c;
    z = Df(c[u >> 2] | 0, c[c[r >> 2] >> 2] | 0) | 0;
    A = c[q >> 2] | 0;
    c[q >> 2] = A + 1;
    c[(c[y >> 2] | 0) + (A << 2) >> 2] = z;
    c[r >> 2] = (c[r >> 2] | 0) + 4;
   }
  } while (0);
  if (c[t >> 2] | 0) B = 50; else if (!(c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 40 >> 2] | 0)) B = 50;
  if ((B | 0) == 50) {
   A = nh(c[u >> 2] | 0) | 0;
   B = c[q >> 2] | 0;
   c[q >> 2] = B + 1;
   c[(c[y >> 2] | 0) + (B << 2) >> 2] = A;
  }
  c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] = 0;
  c[w >> 2] = pg(c[m >> 2] | 0, c[(c[m >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 4 >> 2] | 0, c[y >> 2] | 0, 1, c[p >> 2] | 0) | 0;
 }
 c[q >> 2] = 0;
 while (1) {
  if (!(c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] | 0)) break;
  Cj(c[(c[y >> 2] | 0) + (c[q >> 2] << 2) >> 2] | 0);
  c[q >> 2] = (c[q >> 2] | 0) + 1;
 }
 Cj(c[y >> 2] | 0);
 if (!((c[o >> 2] | 0) != 0 ? (c[c[w >> 2] >> 2] | 0) == 0 : 0)) {
  B = c[u >> 2] | 0;
  Cj(B);
  B = c[w >> 2] | 0;
  i = C;
  return B | 0;
 }
 c[w >> 2] = kh(8) | 0;
 B = Vg(c[m >> 2] | 0, c[n >> 2] | 0, c[u >> 2] | 0) | 0;
 c[c[w >> 2] >> 2] = B;
 if (!(c[c[w >> 2] >> 2] | 0)) {
  B = c[u >> 2] | 0;
  Cj(B);
  B = c[w >> 2] | 0;
  i = C;
  return B | 0;
 }
 c[(c[w >> 2] | 0) + 4 >> 2] = 0;
 B = c[u >> 2] | 0;
 Cj(B);
 B = c[w >> 2] | 0;
 i = C;
 return B | 0;
}

function qd() {
 var b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f;
 c[b >> 2] = 0;
 c[67] = (c[67] | 0) + 1;
 if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) e = 3; else if ((c[67] | 0) == (c[21] | 0)) e = 3;
 if ((e | 0) == 3) if (!(pd() | 0)) {
  e = c[b >> 2] | 0;
  i = f;
  return e | 0;
 }
 if ((c[273] | 0) > 1) if ((d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0 | 0) == 32) if ((d[(c[17] | 0) + ((c[273] | 0) - 2) >> 0] | 0 | 0) == 32) c[273] = (c[273] | 0) - 1;
 c[339] = 0;
 a : do if (c[340] | 0) {
  b : while (1) {
   if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == (d[9382] | 0 | 0)) break a;
   switch (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) {
   case 125:
    {
     e = 33;
     break b;
    }
   case 123:
    break;
   default:
    {
     if ((c[273] | 0) == (c[14] | 0)) {
      e = 35;
      break b;
     }
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[15] | 0) + (c[67] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     c[67] = (c[67] | 0) + 1;
     if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) != (c[21] | 0)) continue b;
     if (pd() | 0) continue b; else {
      e = 59;
      break b;
     }
    }
   }
   c[339] = (c[339] | 0) + 1;
   if ((c[273] | 0) == (c[14] | 0)) {
    e = 12;
    break;
   }
   a[(c[17] | 0) + (c[273] | 0) >> 0] = 123;
   c[273] = (c[273] | 0) + 1;
   c[67] = (c[67] | 0) + 1;
   if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) e = 15; else if ((c[67] | 0) == (c[21] | 0)) e = 15;
   if ((e | 0) == 15) {
    e = 0;
    if (!(pd() | 0)) {
     e = 59;
     break;
    }
   }
   c : while (1) switch (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) {
   case 125:
    {
     c[339] = (c[339] | 0) - 1;
     if ((c[273] | 0) == (c[14] | 0)) {
      e = 18;
      break b;
     }
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 125;
     c[273] = (c[273] | 0) + 1;
     c[67] = (c[67] | 0) + 1;
     if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) e = 21; else if ((c[67] | 0) == (c[21] | 0)) e = 21;
     if ((e | 0) == 21) {
      e = 0;
      if (!(pd() | 0)) {
       e = 59;
       break b;
      }
     }
     if (!(c[339] | 0)) continue b; else continue c;
    }
   case 123:
    {
     c[339] = (c[339] | 0) + 1;
     if ((c[273] | 0) == (c[14] | 0)) {
      e = 24;
      break b;
     }
     a[(c[17] | 0) + (c[273] | 0) >> 0] = 123;
     c[273] = (c[273] | 0) + 1;
     c[67] = (c[67] | 0) + 1;
     if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) != (c[21] | 0)) continue c;
     if (pd() | 0) continue c; else {
      e = 59;
      break b;
     }
    }
   default:
    {
     if ((c[273] | 0) == (c[14] | 0)) {
      e = 29;
      break b;
     }
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[15] | 0) + (c[67] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     c[67] = (c[67] | 0) + 1;
     if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) != (c[21] | 0)) continue c;
     if (pd() | 0) continue c; else {
      e = 59;
      break b;
     }
    }
   }
  }
  if ((e | 0) == 12) {
   oc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 18) {
   oc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 24) {
   oc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 29) {
   oc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 33) {
   nc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 35) {
   oc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 59) {
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  }
 } else {
  d : while (1) {
   if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == (d[9382] | 0 | 0)) break a;
   if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
     e = 54;
     break;
    }
    c[67] = (c[67] | 0) + 1;
    if (cd(a[9382] | 0, 123, 125) | 0) continue;
    if (od() | 0) continue; else {
     e = 57;
     break;
    }
   }
   c[339] = (c[339] | 0) + 1;
   c[67] = (c[67] | 0) + 1;
   if (!(od() | 0)) {
    e = 42;
    break;
   }
   while (1) {
    if ((c[339] | 0) <= 0) continue d;
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
     c[339] = (c[339] | 0) - 1;
     c[67] = (c[67] | 0) + 1;
     if (od() | 0) continue; else {
      e = 46;
      break d;
     }
    }
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 123) {
     c[339] = (c[339] | 0) + 1;
     c[67] = (c[67] | 0) + 1;
     if (od() | 0) continue; else {
      e = 49;
      break d;
     }
    }
    c[67] = (c[67] | 0) + 1;
    if (ad(125, 123) | 0) continue;
    if (!(od() | 0)) {
     e = 52;
     break d;
    }
   }
  }
  if ((e | 0) == 42) {
   kc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 46) {
   kc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 49) {
   kc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 52) {
   kc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 54) {
   nc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  } else if ((e | 0) == 57) {
   kc();
   e = c[b >> 2] | 0;
   i = f;
   return e | 0;
  }
 } while (0);
 c[67] = (c[67] | 0) + 1;
 c[b >> 2] = 1;
 e = c[b >> 2] | 0;
 i = f;
 return e | 0;
}

function Ud() {
 var b = 0, e = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 if ((d[9385] | 0 | 0) != 1) {
  Ed(c[387] | 0, a[9385] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 switch (d[(c[64] | 0) + (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) >> 0] | 0 | 0) {
 case 84:
 case 116:
  {
   a[9386] = 0;
   break;
  }
 case 76:
 case 108:
  {
   a[9386] = 1;
   break;
  }
 case 85:
 case 117:
  {
   a[9386] = 2;
   break;
  }
 default:
  a[9386] = 3;
 }
 if (((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) | 0) != 1) b = 12; else if ((d[9386] | 0 | 0) == 3) b = 12;
 if ((b | 0) == 12) {
  a[9386] = 3;
  Ab(c[367] | 0);
  Qi(13351, c[11] | 0) | 0;
  Qi(13351, c[12] | 0) | 0;
  wc();
 }
 c[355] = 0;
 Kd(c[387] | 0);
 c[352] = 0;
 c[273] = 0;
 while (1) {
  if ((c[273] | 0) >= (c[355] | 0)) break;
  a : do if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 123) {
   c[352] = (c[352] | 0) + 1;
   do if ((c[352] | 0) == 1) if (((c[273] | 0) + 4 | 0) <= (c[355] | 0)) if ((d[(c[17] | 0) + ((c[273] | 0) + 1) >> 0] | 0 | 0) == 92) {
    if (!(d[9386] | 0)) {
     if (!(c[273] | 0)) break;
     if (c[399] | 0) if ((d[8613 + (d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0) >> 0] | 0 | 0) == 1) break;
    }
    c[273] = (c[273] | 0) + 1;
    b : while (1) {
     b = c[273] | 0;
     if (!((c[273] | 0) < (c[355] | 0) ? (c[352] | 0) > 0 : 0)) break;
     c[273] = b + 1;
     c[345] = c[273];
     while (1) {
      if ((c[273] | 0) >= (c[355] | 0)) break;
      if ((d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) != 2) break;
      c[273] = (c[273] | 0) + 1;
     }
     c[360] = Qc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0, 14, 0) | 0;
     c : do if (c[263] | 0) switch (d[9386] | 0 | 0) {
     case 3:
      break c;
     case 1:
     case 0:
      {
       switch (c[(c[271] | 0) + (c[360] << 2) >> 2] | 0) {
       case 7:
       case 5:
       case 3:
       case 9:
       case 11:
        break;
       default:
        break c;
       }
       Oc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
       break c;
      }
     case 2:
      {
       switch (c[(c[271] | 0) + (c[360] << 2) >> 2] | 0) {
       case 6:
       case 4:
       case 2:
       case 8:
       case 10:
        {
         Pc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
         break c;
        }
       case 12:
       case 1:
       case 0:
        break;
       default:
        break c;
       }
       Pc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
       while (1) {
        b = c[345] | 0;
        if ((c[345] | 0) >= (c[273] | 0)) break;
        a[(c[17] | 0) + ((c[345] | 0) - 1) >> 0] = a[(c[17] | 0) + b >> 0] | 0;
        c[345] = (c[345] | 0) + 1;
       }
       c[345] = b - 1;
       while (1) {
        if ((c[273] | 0) < (c[355] | 0)) e = (d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1; else e = 0;
        b = c[273] | 0;
        if (!e) break;
        c[273] = b + 1;
       }
       c[274] = b;
       while (1) {
        b = c[274] | 0;
        if ((c[274] | 0) >= (c[355] | 0)) break;
        a[(c[17] | 0) + ((c[274] | 0) - ((c[273] | 0) - (c[345] | 0))) >> 0] = a[(c[17] | 0) + b >> 0] | 0;
        c[274] = (c[274] | 0) + 1;
       }
       c[355] = b - ((c[273] | 0) - (c[345] | 0));
       c[273] = c[345];
       break c;
      }
     default:
      {
       Hc();
       break c;
      }
     } while (0);
     c[345] = c[273];
     while (1) {
      if (!((c[352] | 0) > 0 ? (c[273] | 0) < (c[355] | 0) : 0)) break;
      if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 92) break;
      do if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; else {
       if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) != 123) break;
       c[352] = (c[352] | 0) + 1;
      } while (0);
      c[273] = (c[273] | 0) + 1;
     }
     switch (d[9386] | 0 | 0) {
     case 3:
      continue b;
     case 1:
     case 0:
      {
       Oc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
       continue b;
      }
     case 2:
      {
       Pc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
       continue b;
      }
     default:
      {
       Hc();
       continue b;
      }
     }
    }
    c[273] = b - 1;
   } while (0);
   c[399] = 0;
  } else {
   if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125) {
    td(c[387] | 0);
    c[399] = 0;
    break;
   }
   if (!(c[352] | 0)) switch (d[9386] | 0 | 0) {
   case 3:
    break a;
   case 0:
    {
     do if (c[273] | 0) {
      if (c[399] | 0) if ((d[8613 + (d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0) >> 0] | 0 | 0) == 1) break;
      Oc(c[17] | 0, c[273] | 0, 1);
     } while (0);
     if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 58) {
      c[399] = 1;
      break a;
     }
     if ((d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) break a;
     c[399] = 0;
     break a;
    }
   case 1:
    {
     Oc(c[17] | 0, c[273] | 0, 1);
     break a;
    }
   case 2:
    {
     Pc(c[17] | 0, c[273] | 0, 1);
     break a;
    }
   default:
    {
     Hc();
     break a;
    }
   }
  } while (0);
  c[273] = (c[273] | 0) + 1;
 }
 ud(c[387] | 0);
 Jd();
 return;
}

function Jf(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0, D = 0, E = 0, F = 0, G = 0, H = 0, I = 0, J = 0, K = 0, L = 0, M = 0, N = 0;
 N = i;
 i = i + 144 | 0;
 k = N + 136 | 0;
 L = N;
 l = N + 132 | 0;
 m = N + 128 | 0;
 n = N + 124 | 0;
 o = N + 120 | 0;
 p = N + 116 | 0;
 u = N + 112 | 0;
 G = N + 108 | 0;
 A = N + 104 | 0;
 F = N + 100 | 0;
 H = N + 96 | 0;
 K = N + 92 | 0;
 x = N + 88 | 0;
 h = N + 84 | 0;
 r = N + 80 | 0;
 I = N + 76 | 0;
 E = N + 72 | 0;
 J = N + 68 | 0;
 j = N + 64 | 0;
 g = N + 56 | 0;
 B = N + 48 | 0;
 w = N + 44 | 0;
 z = N + 40 | 0;
 C = N + 36 | 0;
 t = N + 32 | 0;
 v = N + 28 | 0;
 D = N + 24 | 0;
 y = N + 20 | 0;
 q = N + 16 | 0;
 s = N + 12 | 0;
 c[m >> 2] = b;
 c[n >> 2] = d;
 c[o >> 2] = e;
 c[p >> 2] = f;
 c[K >> 2] = 0;
 c[J >> 2] = 0;
 c[j >> 2] = 0;
 if (!(c[(c[m >> 2] | 0) + 20 >> 2] | 0)) {
  c[l >> 2] = 0;
  M = c[l >> 2] | 0;
  i = N;
  return M | 0;
 }
 c[h >> 2] = 0;
 while (1) {
  if (c[j >> 2] | 0) break;
  if ((c[h >> 2] | 0) >>> 0 >= (c[(c[m >> 2] | 0) + 36 >> 2] | 0) >>> 0) break;
  c[j >> 2] = Nf(c[(c[(c[m >> 2] | 0) + 36 + 4 >> 2] | 0) + (c[h >> 2] << 2) >> 2] | 0, c[o >> 2] | 0) | 0;
  c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 if (!(c[j >> 2] | 0)) {
  c[l >> 2] = 0;
  M = c[l >> 2] | 0;
  i = N;
  return M | 0;
 }
 c[x >> 2] = 0;
 c[J >> 2] = kh(8) | 0;
 j = c[J >> 2] | 0;
 Kf(g);
 c[j >> 2] = c[g >> 2];
 c[j + 4 >> 2] = c[g + 4 >> 2];
 c[E >> 2] = 0;
 while (1) {
  if (c[x >> 2] | 0) break;
  if (!(c[(c[n >> 2] | 0) + (c[E >> 2] << 2) >> 2] | 0)) break;
  c[F >> 2] = c[(c[n >> 2] | 0) + (c[E >> 2] << 2) >> 2];
  if (!(yf(c[m >> 2] | 0, c[F >> 2] | 0, 1) | 0)) {
   c[A >> 2] = ri(c[F >> 2] | 0, 47) | 0;
   if (c[A >> 2] | 0) if ((c[A >> 2] | 0) != (c[F >> 2] | 0)) {
    c[B >> 2] = (c[A >> 2] | 0) - (c[F >> 2] | 0) + 1;
    c[w >> 2] = kh(c[B >> 2] | 0) | 0;
    Ai(c[w >> 2] | 0, c[F >> 2] | 0, (c[B >> 2] | 0) - 1 | 0) | 0;
    a[(c[w >> 2] | 0) + ((c[B >> 2] | 0) - 1) >> 0] = 0;
    j = Ef(c[o >> 2] | 0, 29173, c[w >> 2] | 0) | 0;
    c[K >> 2] = j;
    c[H >> 2] = j;
    c[F >> 2] = (c[A >> 2] | 0) + 1;
    Cj(c[w >> 2] | 0);
   } else M = 16; else M = 16;
   if ((M | 0) == 16) {
    M = 0;
    c[H >> 2] = c[o >> 2];
   }
   if (c[(c[m >> 2] | 0) + 28 >> 2] | 0) {
    e = (c[m >> 2] | 0) + 28 | 0;
    j = c[F >> 2] | 0;
    c[k >> 2] = c[e >> 2];
    c[k + 4 >> 2] = c[e + 4 >> 2];
    c[r >> 2] = fg(k, j) | 0;
   } else c[r >> 2] = 0;
   if (!(c[r >> 2] | 0)) {
    c[r >> 2] = kh(4) | 0;
    c[c[r >> 2] >> 2] = 0;
   }
   c[C >> 2] = 1;
   c[I >> 2] = c[r >> 2];
   while (1) {
    if (!(c[c[I >> 2] >> 2] | 0)) break;
    c[C >> 2] = (c[C >> 2] | 0) + 1;
    c[I >> 2] = (c[I >> 2] | 0) + 4;
   }
   c[r >> 2] = mh(c[r >> 2] | 0, (c[C >> 2] | 0) + 1 << 2) | 0;
   c[z >> 2] = c[C >> 2];
   while (1) {
    if ((c[z >> 2] | 0) >>> 0 <= 0) break;
    c[(c[r >> 2] | 0) + (c[z >> 2] << 2) >> 2] = c[(c[r >> 2] | 0) + ((c[z >> 2] | 0) - 1 << 2) >> 2];
    c[z >> 2] = (c[z >> 2] | 0) + -1;
   }
   c[c[r >> 2] >> 2] = c[F >> 2];
   c[I >> 2] = c[r >> 2];
   while (1) {
    if (c[x >> 2] | 0) break;
    if (!(c[c[I >> 2] >> 2] | 0)) break;
    c[t >> 2] = c[c[I >> 2] >> 2];
    e = (c[m >> 2] | 0) + 20 | 0;
    j = c[t >> 2] | 0;
    c[k >> 2] = c[e >> 2];
    c[k + 4 >> 2] = c[e + 4 >> 2];
    j = fg(k, j) | 0;
    c[u >> 2] = j;
    c[G >> 2] = j;
    while (1) {
     if (!((c[x >> 2] | 0) == 0 & (c[u >> 2] | 0) != 0)) break;
     if (!(c[c[u >> 2] >> 2] | 0)) break;
     c[v >> 2] = Df(c[c[u >> 2] >> 2] | 0, c[t >> 2] | 0) | 0;
     c[D >> 2] = Of(c[v >> 2] | 0, c[H >> 2] | 0) | 0;
     if (c[(c[m >> 2] | 0) + 44 >> 2] & 32) {
      Qi(29466, c[1840] | 0) | 0;
      j = c[1840] | 0;
      d = c[H >> 2] | 0;
      e = c[D >> 2] | 0;
      c[L >> 2] = c[v >> 2];
      c[L + 4 >> 2] = d;
      c[L + 8 >> 2] = e;
      $i(j, 20275, L) | 0;
      ij(c[1840] | 0) | 0;
     }
     do if (c[D >> 2] | 0) {
      c[y >> 2] = 0;
      j = (Jg(c[m >> 2] | 0, c[v >> 2] | 0) | 0) != 0;
      g = c[v >> 2] | 0;
      a : do if (j) c[y >> 2] = g; else {
       Cj(g);
       c[q >> 2] = (c[r >> 2] | 0) + 4;
       while (1) {
        if (!(c[c[q >> 2] >> 2] | 0)) break a;
        if (!((c[y >> 2] | 0) != 0 ^ 1)) break a;
        c[s >> 2] = Df(c[c[u >> 2] >> 2] | 0, c[c[q >> 2] >> 2] | 0) | 0;
        j = (Jg(c[m >> 2] | 0, c[s >> 2] | 0) | 0) != 0;
        g = c[s >> 2] | 0;
        if (j) c[y >> 2] = g; else Cj(g);
        c[q >> 2] = (c[q >> 2] | 0) + 4;
       }
      } while (0);
      if (!(c[y >> 2] | 0)) break;
      Lg(c[J >> 2] | 0, c[y >> 2] | 0);
      if (!((c[p >> 2] | 0) == 0 & (c[y >> 2] | 0) != 0)) break;
      c[x >> 2] = 1;
     } else Cj(c[v >> 2] | 0); while (0);
     c[u >> 2] = (c[u >> 2] | 0) + 4;
    }
    if (c[G >> 2] | 0) if (c[c[G >> 2] >> 2] | 0) Cj(c[G >> 2] | 0);
    c[I >> 2] = (c[I >> 2] | 0) + 4;
   }
   Cj(c[r >> 2] | 0);
   if (c[K >> 2] | 0) Cj(c[K >> 2] | 0);
  }
  c[E >> 2] = (c[E >> 2] | 0) + 1;
 }
 c[l >> 2] = c[J >> 2];
 M = c[l >> 2] | 0;
 i = N;
 return M | 0;
}

function If(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0, D = 0, E = 0, F = 0, G = 0, H = 0, I = 0, J = 0, K = 0, L = 0;
 L = i;
 i = i + 144 | 0;
 r = L + 128 | 0;
 K = L;
 s = L + 120 | 0;
 t = L + 116 | 0;
 g = L + 112 | 0;
 h = L + 108 | 0;
 u = L + 104 | 0;
 A = L + 100 | 0;
 F = L + 96 | 0;
 m = L + 92 | 0;
 G = L + 88 | 0;
 J = L + 84 | 0;
 C = L + 80 | 0;
 k = L + 76 | 0;
 I = L + 72 | 0;
 x = L + 68 | 0;
 H = L + 64 | 0;
 p = L + 60 | 0;
 n = L + 56 | 0;
 j = L + 52 | 0;
 l = L + 48 | 0;
 o = L + 44 | 0;
 z = L + 40 | 0;
 v = L + 32 | 0;
 B = L + 28 | 0;
 E = L + 24 | 0;
 D = L + 20 | 0;
 w = L + 16 | 0;
 y = L + 12 | 0;
 c[t >> 2] = b;
 c[g >> 2] = d;
 c[h >> 2] = e;
 c[u >> 2] = f;
 c[J >> 2] = 0;
 c[I >> 2] = 0;
 c[p >> 2] = 0;
 if (!(c[(c[t >> 2] | 0) + 20 >> 2] | 0)) {
  c[s >> 2] = 0;
  K = c[s >> 2] | 0;
  i = L;
  return K | 0;
 }
 c[m >> 2] = ri(c[g >> 2] | 0, 47) | 0;
 if (c[m >> 2] | 0) if ((c[m >> 2] | 0) != (c[g >> 2] | 0)) {
  c[n >> 2] = (c[m >> 2] | 0) - (c[g >> 2] | 0) + 1;
  c[j >> 2] = kh(c[n >> 2] | 0) | 0;
  Ai(c[j >> 2] | 0, c[g >> 2] | 0, (c[n >> 2] | 0) - 1 | 0) | 0;
  a[(c[j >> 2] | 0) + ((c[n >> 2] | 0) - 1) >> 0] = 0;
  e = Ef(c[h >> 2] | 0, 29173, c[j >> 2] | 0) | 0;
  c[J >> 2] = e;
  c[G >> 2] = e;
  c[g >> 2] = (c[m >> 2] | 0) + 1;
  Cj(c[j >> 2] | 0);
 } else q = 6; else q = 6;
 if ((q | 0) == 6) c[G >> 2] = c[h >> 2];
 c[k >> 2] = 0;
 while (1) {
  if (c[p >> 2] | 0) break;
  if ((c[k >> 2] | 0) >>> 0 >= (c[(c[t >> 2] | 0) + 36 >> 2] | 0) >>> 0) break;
  c[p >> 2] = Nf(c[(c[(c[t >> 2] | 0) + 36 + 4 >> 2] | 0) + (c[k >> 2] << 2) >> 2] | 0, c[G >> 2] | 0) | 0;
  c[k >> 2] = (c[k >> 2] | 0) + 1;
 }
 if (!(c[p >> 2] | 0)) {
  c[s >> 2] = 0;
  K = c[s >> 2] | 0;
  i = L;
  return K | 0;
 }
 if (c[(c[t >> 2] | 0) + 28 >> 2] | 0) {
  p = (c[t >> 2] | 0) + 28 | 0;
  q = c[g >> 2] | 0;
  c[r >> 2] = c[p >> 2];
  c[r + 4 >> 2] = c[p + 4 >> 2];
  c[x >> 2] = fg(r, q) | 0;
 } else c[x >> 2] = 0;
 if (!(c[x >> 2] | 0)) {
  c[x >> 2] = kh(4) | 0;
  c[c[x >> 2] >> 2] = 0;
 }
 c[o >> 2] = 1;
 c[H >> 2] = c[x >> 2];
 while (1) {
  if (!(c[c[H >> 2] >> 2] | 0)) break;
  c[o >> 2] = (c[o >> 2] | 0) + 1;
  c[H >> 2] = (c[H >> 2] | 0) + 4;
 }
 c[x >> 2] = mh(c[x >> 2] | 0, (c[o >> 2] | 0) + 1 << 2) | 0;
 c[l >> 2] = c[o >> 2];
 while (1) {
  if ((c[l >> 2] | 0) >>> 0 <= 0) break;
  c[(c[x >> 2] | 0) + (c[l >> 2] << 2) >> 2] = c[(c[x >> 2] | 0) + ((c[l >> 2] | 0) - 1 << 2) >> 2];
  c[l >> 2] = (c[l >> 2] | 0) + -1;
 }
 c[c[x >> 2] >> 2] = c[g >> 2];
 c[C >> 2] = 0;
 c[H >> 2] = c[x >> 2];
 while (1) {
  if (c[C >> 2] | 0) break;
  if (!(c[c[H >> 2] >> 2] | 0)) break;
  c[z >> 2] = c[c[H >> 2] >> 2];
  p = (c[t >> 2] | 0) + 20 | 0;
  q = c[z >> 2] | 0;
  c[r >> 2] = c[p >> 2];
  c[r + 4 >> 2] = c[p + 4 >> 2];
  q = fg(r, q) | 0;
  c[A >> 2] = q;
  c[F >> 2] = q;
  c[I >> 2] = kh(8) | 0;
  q = c[I >> 2] | 0;
  Kf(v);
  c[q >> 2] = c[v >> 2];
  c[q + 4 >> 2] = c[v + 4 >> 2];
  while (1) {
   if (!((c[C >> 2] | 0) == 0 & (c[A >> 2] | 0) != 0)) break;
   if (!(c[c[A >> 2] >> 2] | 0)) break;
   c[B >> 2] = Df(c[c[A >> 2] >> 2] | 0, c[z >> 2] | 0) | 0;
   c[E >> 2] = Of(c[B >> 2] | 0, c[G >> 2] | 0) | 0;
   if (c[(c[t >> 2] | 0) + 44 >> 2] & 32) {
    Qi(29466, c[1840] | 0) | 0;
    q = c[1840] | 0;
    e = c[G >> 2] | 0;
    p = c[E >> 2] | 0;
    c[K >> 2] = c[B >> 2];
    c[K + 4 >> 2] = e;
    c[K + 8 >> 2] = p;
    $i(q, 20275, K) | 0;
    ij(c[1840] | 0) | 0;
   }
   if (c[E >> 2] | 0) {
    c[D >> 2] = 0;
    q = (Jg(c[t >> 2] | 0, c[B >> 2] | 0) | 0) != 0;
    g = c[B >> 2] | 0;
    a : do if (q) c[D >> 2] = g; else {
     Cj(g);
     c[w >> 2] = (c[x >> 2] | 0) + 4;
     while (1) {
      if (!(c[c[w >> 2] >> 2] | 0)) break a;
      if (!((c[D >> 2] | 0) != 0 ^ 1)) break a;
      c[y >> 2] = Df(c[c[A >> 2] >> 2] | 0, c[c[w >> 2] >> 2] | 0) | 0;
      q = (Jg(c[t >> 2] | 0, c[y >> 2] | 0) | 0) != 0;
      g = c[y >> 2] | 0;
      if (q) c[D >> 2] = g; else Cj(g);
      c[w >> 2] = (c[w >> 2] | 0) + 4;
     }
    } while (0);
    if (c[D >> 2] | 0) {
     Lg(c[I >> 2] | 0, c[D >> 2] | 0);
     if ((c[u >> 2] | 0) == 0 & (c[D >> 2] | 0) != 0) c[C >> 2] = 1;
    }
   } else Cj(c[B >> 2] | 0);
   c[A >> 2] = (c[A >> 2] | 0) + 4;
  }
  if (c[F >> 2] | 0) if (c[c[F >> 2] >> 2] | 0) Cj(c[F >> 2] | 0);
  c[H >> 2] = (c[H >> 2] | 0) + 4;
 }
 Cj(c[x >> 2] | 0);
 if (c[J >> 2] | 0) Cj(c[J >> 2] | 0);
 c[s >> 2] = c[I >> 2];
 K = c[s >> 2] | 0;
 i = L;
 return K | 0;
}

function xe() {
 var b = 0, e = 0;
 if (c[696] | 0) {
  Qi(14350, c[11] | 0) | 0;
  Qi(14350, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[696] = 1;
 if (!(id() | 0)) {
  _b();
  Qi(10410, c[11] | 0) | 0;
  Qi(10410, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(10410, c[11] | 0) | 0;
  Qi(10410, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(10410, c[11] | 0) | 0;
  Qi(10410, c[12] | 0) | 0;
  Yb();
  return;
 }
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   e = 17;
   break;
  }
  ed(125, 37, 37);
  if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
   e = 12;
   break;
  }
  Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
  c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
  b = c[332] | 0;
  if (c[263] | 0) {
   e = 14;
   break;
  }
  a[(c[166] | 0) + b >> 0] = 4;
  c[(c[271] | 0) + (c[332] << 2) >> 2] = c[269];
  c[269] = (c[269] | 0) + 1;
  if (!(id() | 0)) {
   e = 16;
   break;
  }
 }
 if ((e | 0) == 12) {
  cc();
  Qi(10410, c[11] | 0) | 0;
  Qi(10410, c[12] | 0) | 0;
  Yb();
  return;
 } else if ((e | 0) == 14) {
  fc(b);
  return;
 } else if ((e | 0) == 16) {
  _b();
  Qi(10410, c[11] | 0) | 0;
  Qi(10410, c[12] | 0) | 0;
  Yb();
  return;
 } else if ((e | 0) == 17) {
  c[67] = (c[67] | 0) + 1;
  if (!(id() | 0)) {
   _b();
   Qi(10410, c[11] | 0) | 0;
   Qi(10410, c[12] | 0) | 0;
   Yb();
   return;
  }
  if ((c[269] | 0) == (c[328] | 0)) {
   Qi(14381, c[11] | 0) | 0;
   Qi(14381, c[12] | 0) | 0;
   Zb();
  }
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
   dc();
   Qi(10410, c[11] | 0) | 0;
   Qi(10410, c[12] | 0) | 0;
   Yb();
   return;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(id() | 0)) {
   _b();
   Qi(10410, c[11] | 0) | 0;
   Qi(10410, c[12] | 0) | 0;
   Yb();
   return;
  }
  while (1) {
   if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
    e = 33;
    break;
   }
   ed(125, 37, 37);
   if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
    e = 28;
    break;
   }
   Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
   c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
   b = c[332] | 0;
   if (c[263] | 0) {
    e = 30;
    break;
   }
   a[(c[166] | 0) + b >> 0] = 5;
   c[(c[271] | 0) + (c[332] << 2) >> 2] = c[390];
   c[390] = (c[390] | 0) + 1;
   if (!(id() | 0)) {
    e = 32;
    break;
   }
  }
  if ((e | 0) == 28) {
   cc();
   Qi(10410, c[11] | 0) | 0;
   Qi(10410, c[12] | 0) | 0;
   Yb();
   return;
  } else if ((e | 0) == 30) {
   fc(b);
   return;
  } else if ((e | 0) == 32) {
   _b();
   Qi(10410, c[11] | 0) | 0;
   Qi(10410, c[12] | 0) | 0;
   Yb();
   return;
  } else if ((e | 0) == 33) {
   c[67] = (c[67] | 0) + 1;
   if (!(id() | 0)) {
    _b();
    Qi(10410, c[11] | 0) | 0;
    Qi(10410, c[12] | 0) | 0;
    Yb();
    return;
   }
   if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
    dc();
    Qi(10410, c[11] | 0) | 0;
    Qi(10410, c[12] | 0) | 0;
    Yb();
    return;
   }
   c[67] = (c[67] | 0) + 1;
   if (!(id() | 0)) {
    _b();
    Qi(10410, c[11] | 0) | 0;
    Qi(10410, c[12] | 0) | 0;
    Yb();
    return;
   }
   while (1) {
    if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
     e = 47;
     break;
    }
    ed(125, 37, 37);
    if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
     e = 42;
     break;
    }
    Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
    c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
    b = c[332] | 0;
    if (c[263] | 0) {
     e = 44;
     break;
    }
    a[(c[166] | 0) + b >> 0] = 6;
    c[(c[271] | 0) + (c[332] << 2) >> 2] = c[277];
    c[277] = (c[277] | 0) + 1;
    if (!(id() | 0)) {
     e = 46;
     break;
    }
   }
   if ((e | 0) == 42) {
    cc();
    Qi(10410, c[11] | 0) | 0;
    Qi(10410, c[12] | 0) | 0;
    Yb();
    return;
   } else if ((e | 0) == 44) {
    fc(b);
    return;
   } else if ((e | 0) == 46) {
    _b();
    Qi(10410, c[11] | 0) | 0;
    Qi(10410, c[12] | 0) | 0;
    Yb();
    return;
   } else if ((e | 0) == 47) {
    c[67] = (c[67] | 0) + 1;
    return;
   }
  }
 }
}

function Fj(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0;
 o = a + 4 | 0;
 p = c[o >> 2] | 0;
 j = p & -8;
 l = a + j | 0;
 i = c[1969] | 0;
 d = p & 3;
 if (!((d | 0) != 1 & a >>> 0 >= i >>> 0 & a >>> 0 < l >>> 0)) oa();
 e = a + (j | 4) | 0;
 f = c[e >> 2] | 0;
 if (!(f & 1)) oa();
 if (!d) {
  if (b >>> 0 < 256) {
   a = 0;
   return a | 0;
  }
  if (j >>> 0 >= (b + 4 | 0) >>> 0) if ((j - b | 0) >>> 0 <= c[2085] << 1 >>> 0) return a | 0;
  a = 0;
  return a | 0;
 }
 if (j >>> 0 >= b >>> 0) {
  d = j - b | 0;
  if (d >>> 0 <= 15) return a | 0;
  c[o >> 2] = p & 1 | b | 2;
  c[a + (b + 4) >> 2] = d | 3;
  c[e >> 2] = c[e >> 2] | 1;
  Gj(a + b | 0, d);
  return a | 0;
 }
 if ((l | 0) == (c[1971] | 0)) {
  d = (c[1968] | 0) + j | 0;
  if (d >>> 0 <= b >>> 0) {
   a = 0;
   return a | 0;
  }
  n = d - b | 0;
  c[o >> 2] = p & 1 | b | 2;
  c[a + (b + 4) >> 2] = n | 1;
  c[1971] = a + b;
  c[1968] = n;
  return a | 0;
 }
 if ((l | 0) == (c[1970] | 0)) {
  e = (c[1967] | 0) + j | 0;
  if (e >>> 0 < b >>> 0) {
   a = 0;
   return a | 0;
  }
  d = e - b | 0;
  if (d >>> 0 > 15) {
   c[o >> 2] = p & 1 | b | 2;
   c[a + (b + 4) >> 2] = d | 1;
   c[a + e >> 2] = d;
   e = a + (e + 4) | 0;
   c[e >> 2] = c[e >> 2] & -2;
   e = a + b | 0;
  } else {
   c[o >> 2] = p & 1 | e | 2;
   e = a + (e + 4) | 0;
   c[e >> 2] = c[e >> 2] | 1;
   e = 0;
   d = 0;
  }
  c[1967] = d;
  c[1970] = e;
  return a | 0;
 }
 if (f & 2) {
  a = 0;
  return a | 0;
 }
 m = (f & -8) + j | 0;
 if (m >>> 0 < b >>> 0) {
  a = 0;
  return a | 0;
 }
 n = m - b | 0;
 g = f >>> 3;
 do if (f >>> 0 < 256) {
  f = c[a + (j + 8) >> 2] | 0;
  e = c[a + (j + 12) >> 2] | 0;
  d = 7900 + (g << 1 << 2) | 0;
  if ((f | 0) != (d | 0)) {
   if (f >>> 0 < i >>> 0) oa();
   if ((c[f + 12 >> 2] | 0) != (l | 0)) oa();
  }
  if ((e | 0) == (f | 0)) {
   c[1965] = c[1965] & ~(1 << g);
   break;
  }
  if ((e | 0) == (d | 0)) h = e + 8 | 0; else {
   if (e >>> 0 < i >>> 0) oa();
   d = e + 8 | 0;
   if ((c[d >> 2] | 0) == (l | 0)) h = d; else oa();
  }
  c[f + 12 >> 2] = e;
  c[h >> 2] = f;
 } else {
  h = c[a + (j + 24) >> 2] | 0;
  g = c[a + (j + 12) >> 2] | 0;
  do if ((g | 0) == (l | 0)) {
   e = a + (j + 20) | 0;
   d = c[e >> 2] | 0;
   if (!d) {
    e = a + (j + 16) | 0;
    d = c[e >> 2] | 0;
    if (!d) {
     k = 0;
     break;
    }
   }
   while (1) {
    f = d + 20 | 0;
    g = c[f >> 2] | 0;
    if (g) {
     d = g;
     e = f;
     continue;
    }
    f = d + 16 | 0;
    g = c[f >> 2] | 0;
    if (!g) break; else {
     d = g;
     e = f;
    }
   }
   if (e >>> 0 < i >>> 0) oa(); else {
    c[e >> 2] = 0;
    k = d;
    break;
   }
  } else {
   f = c[a + (j + 8) >> 2] | 0;
   if (f >>> 0 < i >>> 0) oa();
   d = f + 12 | 0;
   if ((c[d >> 2] | 0) != (l | 0)) oa();
   e = g + 8 | 0;
   if ((c[e >> 2] | 0) == (l | 0)) {
    c[d >> 2] = g;
    c[e >> 2] = f;
    k = g;
    break;
   } else oa();
  } while (0);
  if (h) {
   d = c[a + (j + 28) >> 2] | 0;
   e = 8164 + (d << 2) | 0;
   if ((l | 0) == (c[e >> 2] | 0)) {
    c[e >> 2] = k;
    if (!k) {
     c[1966] = c[1966] & ~(1 << d);
     break;
    }
   } else {
    if (h >>> 0 < (c[1969] | 0) >>> 0) oa();
    d = h + 16 | 0;
    if ((c[d >> 2] | 0) == (l | 0)) c[d >> 2] = k; else c[h + 20 >> 2] = k;
    if (!k) break;
   }
   e = c[1969] | 0;
   if (k >>> 0 < e >>> 0) oa();
   c[k + 24 >> 2] = h;
   d = c[a + (j + 16) >> 2] | 0;
   do if (d) if (d >>> 0 < e >>> 0) oa(); else {
    c[k + 16 >> 2] = d;
    c[d + 24 >> 2] = k;
    break;
   } while (0);
   d = c[a + (j + 20) >> 2] | 0;
   if (d) if (d >>> 0 < (c[1969] | 0) >>> 0) oa(); else {
    c[k + 20 >> 2] = d;
    c[d + 24 >> 2] = k;
    break;
   }
  }
 } while (0);
 if (n >>> 0 < 16) {
  c[o >> 2] = m | p & 1 | 2;
  b = a + (m | 4) | 0;
  c[b >> 2] = c[b >> 2] | 1;
  return a | 0;
 } else {
  c[o >> 2] = p & 1 | b | 2;
  c[a + (b + 4) >> 2] = n | 3;
  p = a + (m | 4) | 0;
  c[p >> 2] = c[p >> 2] | 1;
  Gj(a + b | 0, n);
  return a | 0;
 }
 return 0;
}

function Zc() {
 Rc(11430, 4, 7);
 c[281] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11443, 4, 7);
 c[282] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11456, 4, 7);
 c[283] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11469, 4, 7);
 c[119] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11482, 4, 7);
 c[117] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11495, 10, 8);
 c[284] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11508, 7, 8);
 c[285] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 Rc(11521, 9, 2);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 2;
 Rc(11534, 8, 2);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 0;
 Rc(11547, 9, 2);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 1;
 Rc(11560, 7, 2);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 3;
 Rc(11573, 5, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 0;
 Rc(11586, 7, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 1;
 Rc(11599, 8, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 2;
 Rc(11612, 8, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 3;
 Rc(11625, 7, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 4;
 Rc(11638, 5, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 5;
 Rc(11651, 4, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 6;
 Rc(11664, 7, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 7;
 Rc(11677, 4, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 8;
 Rc(11690, 7, 4);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 9;
 Rc(11703, 7, 12);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 0;
 Rc(11716, 8, 12);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 1;
 Rc(11729, 6, 12);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 2;
 Yc(11742, 1, 1144, 0);
 Yc(11755, 1, 1148, 1);
 Yc(11768, 1, 1152, 2);
 Yc(11781, 1, 1156, 3);
 Yc(11794, 1, 1160, 4);
 Yc(11807, 1, 1164, 5);
 Yc(11820, 2, 1168, 6);
 Yc(11833, 11, 1172, 7);
 Yc(11846, 10, 1176, 8);
 Yc(11859, 12, 1180, 9);
 Yc(11872, 11, 1184, 10);
 Yc(11885, 5, 1188, 11);
 Yc(11898, 10, 1192, 12);
 Yc(11911, 6, 1196, 13);
 Yc(11924, 12, 1200, 14);
 Yc(11937, 3, 1204, 15);
 Yc(11950, 11, 1208, 16);
 Yc(11963, 11, 1212, 17);
 Yc(11976, 8, 1216, 18);
 Yc(11989, 8, 1220, 19);
 Yc(12002, 10, 1224, 20);
 Yc(12015, 4, 1228, 21);
 Yc(12028, 9, 1232, 22);
 Yc(12041, 7, 1236, 23);
 Yc(12054, 6, 1240, 24);
 Yc(12067, 5, 1244, 25);
 Yc(12080, 6, 1248, 26);
 Yc(12093, 10, 1252, 27);
 Yc(12106, 5, 1256, 28);
 Yc(12119, 12, 1260, 29);
 Yc(12132, 12, 1264, 30);
 Yc(12145, 4, 1268, 31);
 Yc(12158, 5, 1272, 32);
 Yc(12171, 8, 1276, 33);
 Yc(12184, 6, 1280, 34);
 Yc(12197, 6, 1284, 35);
 Yc(12210, 6, 1288, 36);
 Rc(11227, 0, 0);
 c[323] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 3;
 Rc(12223, 12, 0);
 c[324] = c[(c[167] | 0) + (c[268] << 2) >> 2];
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 3;
 c[325] = c[311];
 c[326] = 0;
 Rc(12236, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 0;
 Rc(12249, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 1;
 Rc(12262, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 2;
 Rc(12275, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 3;
 Rc(12288, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 4;
 Rc(12301, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 5;
 Rc(12314, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 6;
 Rc(12327, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 7;
 Rc(12340, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 8;
 Rc(12353, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 9;
 Rc(12366, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 10;
 Rc(12379, 1, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 11;
 Rc(12392, 2, 14);
 c[(c[271] | 0) + (c[268] << 2) >> 2] = 12;
 Rc(12405, 8, 11);
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 4;
 c[(c[271] | 0) + (c[268] << 2) >> 2] = c[269];
 c[327] = c[269];
 c[269] = (c[269] | 0) + 1;
 c[328] = c[269];
 Rc(12418, 9, 11);
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 6;
 c[(c[271] | 0) + (c[268] << 2) >> 2] = c[277];
 c[278] = c[277];
 c[277] = (c[277] | 0) + 1;
 Rc(12431, 10, 11);
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 7;
 c[(c[271] | 0) + (c[268] << 2) >> 2] = c[279];
 Rc(12444, 11, 11);
 a[(c[166] | 0) + (c[268] | 0) >> 0] = 7;
 c[(c[271] | 0) + (c[268] << 2) >> 2] = c[329];
 return;
}

function pg(b, d, e, f, g) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 var h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0, A = 0, B = 0, C = 0;
 B = i;
 i = i + 128 | 0;
 A = B + 112 | 0;
 w = B + 24 | 0;
 l = B + 8 | 0;
 h = B;
 x = B + 104 | 0;
 j = B + 100 | 0;
 v = B + 96 | 0;
 m = B + 92 | 0;
 n = B + 88 | 0;
 z = B + 80 | 0;
 y = B + 76 | 0;
 s = B + 72 | 0;
 r = B + 68 | 0;
 k = B + 64 | 0;
 C = B + 56 | 0;
 t = B + 48 | 0;
 p = B + 44 | 0;
 q = B + 40 | 0;
 o = B + 32 | 0;
 c[x >> 2] = b;
 c[j >> 2] = d;
 c[v >> 2] = e;
 c[m >> 2] = f;
 c[n >> 2] = g;
 c[r >> 2] = 0;
 c[k >> 2] = 1;
 sg(C);
 c[z >> 2] = c[C >> 2];
 c[z + 4 >> 2] = c[C + 4 >> 2];
 if (c[(c[x >> 2] | 0) + 44 >> 2] & 32) {
  Qi(29466, c[1840] | 0) | 0;
  C = c[1840] | 0;
  c[h >> 2] = c[c[v >> 2] >> 2];
  $i(C, 21065, h) | 0;
  ij(c[1840] | 0) | 0;
  c[y >> 2] = (c[v >> 2] | 0) + 4;
  while (1) {
   g = c[1840] | 0;
   if (!(c[c[y >> 2] >> 2] | 0)) break;
   Ki(32, g) | 0;
   Qi(c[c[y >> 2] >> 2] | 0, c[1840] | 0) | 0;
   c[y >> 2] = (c[y >> 2] | 0) + 4;
  }
  h = c[n >> 2] | 0;
  C = c[j >> 2] | 0;
  c[l >> 2] = c[m >> 2];
  c[l + 4 >> 2] = h;
  c[l + 8 >> 2] = C;
  $i(g, 21088, l) | 0;
 }
 c[y >> 2] = c[v >> 2];
 while (1) {
  if (!(c[c[y >> 2] >> 2] | 0)) {
   u = 13;
   break;
  }
  if (yf(c[x >> 2] | 0, c[c[y >> 2] >> 2] | 0, 1) | 0) {
   if (Jg(c[x >> 2] | 0, c[c[y >> 2] >> 2] | 0) | 0) {
    Lg(z, nh(c[c[y >> 2] >> 2] | 0) | 0);
    if (!(c[n >> 2] | 0)) break;
   }
  } else c[k >> 2] = 0;
  c[y >> 2] = (c[y >> 2] | 0) + 4;
 }
 a : do if ((u | 0) == 13) if (!(c[k >> 2] | 0)) {
  c[s >> 2] = mg(c[x >> 2] | 0, c[j >> 2] | 0) | 0;
  while (1) {
   if (!((c[r >> 2] | 0) != 0 ? 0 : (c[s >> 2] | 0) != 0)) break a;
   c[p >> 2] = 1;
   if ((a[c[s >> 2] >> 0] | 0) == 33) if ((a[(c[s >> 2] | 0) + 1 >> 0] | 0) == 33) {
    c[p >> 2] = 0;
    c[s >> 2] = (c[s >> 2] | 0) + 2;
   }
   oh(c[x >> 2] | 0, c[s >> 2] | 0) | 0;
   if (c[(c[x >> 2] | 0) + 92 >> 2] | 0) g = Jf(c[x >> 2] | 0, c[v >> 2] | 0, c[s >> 2] | 0, c[n >> 2] | 0) | 0; else g = 0;
   c[t >> 2] = g;
   do if (c[p >> 2] | 0) {
    if (c[t >> 2] | 0) {
     if (!(c[m >> 2] | 0)) break;
     if (c[(c[t >> 2] | 0) + 4 >> 2] | 0) break;
    }
    c[q >> 2] = ph(c[x >> 2] | 0, c[s >> 2] | 0) | 0;
    if (c[q >> 2] | 0) if (c[c[q >> 2] >> 2] | 0) {
     if (!(c[t >> 2] | 0)) c[t >> 2] = kh(8) | 0;
     C = c[t >> 2] | 0;
     tg(o, c[x >> 2] | 0, c[q >> 2] | 0, c[v >> 2] | 0, c[n >> 2] | 0);
     c[C >> 2] = c[o >> 2];
     c[C + 4 >> 2] = c[o + 4 >> 2];
    }
   } while (0);
   do if (c[t >> 2] | 0) if (c[(c[t >> 2] | 0) + 4 >> 2] | 0) {
    g = c[t >> 2] | 0;
    if (c[n >> 2] | 0) {
     c[A >> 2] = c[g >> 2];
     c[A + 4 >> 2] = c[g + 4 >> 2];
     Ng(z, A);
     break;
    } else {
     Lg(z, c[c[g + 4 >> 2] >> 2] | 0);
     c[r >> 2] = 1;
     break;
    }
   } while (0);
   c[s >> 2] = mg(c[x >> 2] | 0, 0) | 0;
  }
 } while (0);
 Qg(z);
 if (!(c[z >> 2] | 0)) u = 39; else if (c[n >> 2] | 0) if (c[(c[z + 4 >> 2] | 0) + ((c[z >> 2] | 0) - 1 << 2) >> 2] | 0) u = 39;
 if ((u | 0) == 39) Lg(z, 0);
 g = c[x >> 2] | 0;
 if (!(c[(c[x >> 2] | 0) + 92 >> 2] | 0)) {
  c[g + 92 >> 2] = 1;
  C = z + 4 | 0;
  C = c[C >> 2] | 0;
  i = B;
  return C | 0;
 }
 if (c[g + 44 >> 2] & 32) {
  Qi(29466, c[1840] | 0) | 0;
  C = c[1840] | 0;
  c[w >> 2] = c[c[v >> 2] >> 2];
  $i(C, 21130, w) | 0;
  ij(c[1840] | 0) | 0;
  c[y >> 2] = (c[v >> 2] | 0) + 4;
  while (1) {
   g = c[1840] | 0;
   if (!(c[c[y >> 2] >> 2] | 0)) break;
   Ki(32, g) | 0;
   Qi(c[c[y >> 2] >> 2] | 0, c[1840] | 0) | 0;
   c[y >> 2] = (c[y >> 2] | 0) + 4;
  }
  Qi(21141, g) | 0;
 }
 C = c[x >> 2] | 0;
 c[A >> 2] = c[z >> 2];
 c[A + 4 >> 2] = c[z + 4 >> 2];
 ug(C, A);
 if (!(c[(c[x >> 2] | 0) + 44 >> 2] & 32)) {
  C = z + 4 | 0;
  C = c[C >> 2] | 0;
  i = B;
  return C | 0;
 }
 Vi(10, c[1840] | 0) | 0;
 C = z + 4 | 0;
 C = c[C >> 2] | 0;
 i = B;
 return C | 0;
}

function Rd() {
 var b = 0, e = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 e = c[387] | 0;
 if ((d[9385] | 0 | 0) != 1) {
  Ed(e, a[9385] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 b = (c[367] | 0) >= (c[386] | 0);
 if ((e | 0) >= (c[386] | 0)) {
  if (b) {
   c[(c[63] | 0) + (c[367] << 2) >> 2] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
   c[22] = (c[22] | 0) + 1;
   c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
   c[382] = (c[382] | 0) + 1;
   return;
  }
  if (!((c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[387] << 2) >> 2] | 0) | 0)) {
   Cd(c[367] | 0, 1);
   return;
  }
  c[259] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
  while (1) {
   if (((c[259] | 0) + ((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0)) | 0) <= (c[65] | 0)) break;
   Bb();
  }
  c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
  c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
  while (1) {
   if ((c[365] | 0) >= (c[366] | 0)) break;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
  Cd(Lc() | 0, 1);
  return;
 }
 if (!b) {
  if (!((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) | 0)) {
   c[382] = (c[382] | 0) + 1;
   return;
  }
  if (!((c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[387] << 2) >> 2] | 0) | 0)) {
   Cd(c[367] | 0, 1);
   return;
  }
  while (1) {
   if (((c[259] | 0) + ((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0)) + ((c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[387] << 2) >> 2] | 0)) | 0) <= (c[65] | 0)) break;
   Bb();
  }
  c[365] = c[(c[63] | 0) + (c[387] << 2) >> 2];
  c[366] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
  while (1) {
   if ((c[365] | 0) >= (c[366] | 0)) break;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
  c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
  c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
  while (1) {
   if ((c[365] | 0) >= (c[366] | 0)) break;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
  Cd(Lc() | 0, 1);
  return;
 }
 if (!((c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[387] << 2) >> 2] | 0) | 0)) {
  c[22] = (c[22] | 0) + 1;
  c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
  c[(c[383] | 0) + (c[382] << 2) >> 2] = c[367];
  c[382] = (c[382] | 0) + 1;
  return;
 }
 if (!((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) | 0)) {
  c[382] = (c[382] | 0) + 1;
  return;
 }
 c[388] = (c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0);
 c[389] = (c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[387] << 2) >> 2] | 0);
 while (1) {
  if (((c[259] | 0) + (c[388] | 0) + (c[389] | 0) | 0) <= (c[65] | 0)) break;
  Bb();
 }
 c[365] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
 c[366] = c[(c[63] | 0) + (c[367] << 2) >> 2];
 c[370] = (c[365] | 0) + (c[389] | 0);
 while (1) {
  if ((c[365] | 0) <= (c[366] | 0)) break;
  c[365] = (c[365] | 0) - 1;
  c[370] = (c[370] | 0) - 1;
  a[(c[64] | 0) + (c[370] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
 }
 c[365] = c[(c[63] | 0) + (c[387] << 2) >> 2];
 c[366] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
 while (1) {
  if ((c[365] | 0) >= (c[366] | 0)) break;
  a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
  c[259] = (c[259] | 0) + 1;
  c[365] = (c[365] | 0) + 1;
 }
 c[259] = (c[259] | 0) + (c[388] | 0);
 Cd(Lc() | 0, 1);
 return;
}

function Cf(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0;
 q = i;
 i = i + 48 | 0;
 h = q + 32 | 0;
 g = q + 28 | 0;
 j = q + 24 | 0;
 n = q + 20 | 0;
 o = q + 16 | 0;
 p = q + 12 | 0;
 m = q + 8 | 0;
 l = q + 4 | 0;
 k = q;
 c[h >> 2] = b;
 c[g >> 2] = e;
 c[m >> 2] = 0;
 while (1) {
  if (hi(a[c[g >> 2] >> 0] | 0) | 0) e = (ni(d[c[g >> 2] >> 0] | 0) | 0) != 0; else e = 0;
  b = c[g >> 2] | 0;
  if (!e) break;
  c[g >> 2] = b + 1;
 }
 if (!(a[b >> 0] | 0)) {
  i = q;
  return;
 }
 if ((a[c[g >> 2] >> 0] | 0) == 37) {
  i = q;
  return;
 }
 if ((a[c[g >> 2] >> 0] | 0) == 35) {
  i = q;
  return;
 }
 e = c[g >> 2] | 0;
 c[o >> 2] = e + (si(c[g >> 2] | 0) | 0) + -1;
 while (1) {
  if ((c[o >> 2] | 0) >>> 0 <= (c[g >> 2] | 0) >>> 0) break;
  if ((a[c[o >> 2] >> 0] | 0) == 37) f = 13; else if ((a[c[o >> 2] >> 0] | 0) == 35) f = 13;
  a : do if ((f | 0) == 13) {
   f = 0;
   c[o >> 2] = (c[o >> 2] | 0) + -1;
   while (1) {
    if (!(hi(a[c[o >> 2] >> 0] | 0) | 0)) break a;
    if (!(ni(d[c[o >> 2] >> 0] | 0) | 0)) break a;
    e = c[o >> 2] | 0;
    c[o >> 2] = e + -1;
    a[e >> 0] = 0;
   }
  } while (0);
  c[o >> 2] = (c[o >> 2] | 0) + -1;
 }
 c[n >> 2] = c[g >> 2];
 while (1) {
  if (hi(a[c[g >> 2] >> 0] | 0) | 0) if (ni(d[c[g >> 2] >> 0] | 0) | 0) b = 0; else f = 21; else f = 21;
  if ((f | 0) == 21) {
   f = 0;
   if ((a[c[g >> 2] >> 0] | 0) != 61) b = (a[c[g >> 2] >> 0] | 0) != 46; else b = 0;
  }
  e = c[g >> 2] | 0;
  if (!b) break;
  c[g >> 2] = e + 1;
 }
 c[j >> 2] = e - (c[n >> 2] | 0);
 c[p >> 2] = kh((c[j >> 2] | 0) + 1 | 0) | 0;
 Ai(c[p >> 2] | 0, c[n >> 2] | 0, c[j >> 2] | 0) | 0;
 a[(c[p >> 2] | 0) + (c[j >> 2] | 0) >> 0] = 0;
 while (1) {
  if (hi(a[c[g >> 2] >> 0] | 0) | 0) e = (ni(d[c[g >> 2] >> 0] | 0) | 0) != 0; else e = 0;
  b = c[g >> 2] | 0;
  if (!e) break;
  c[g >> 2] = b + 1;
 }
 if ((a[b >> 0] | 0) == 46) {
  c[g >> 2] = (c[g >> 2] | 0) + 1;
  while (1) {
   if (hi(a[c[g >> 2] >> 0] | 0) | 0) e = (ni(d[c[g >> 2] >> 0] | 0) | 0) != 0; else e = 0;
   b = c[g >> 2] | 0;
   if (!e) break;
   c[g >> 2] = b + 1;
  }
  c[n >> 2] = b;
  while (1) {
   if (hi(a[c[g >> 2] >> 0] | 0) | 0) if (ni(d[c[g >> 2] >> 0] | 0) | 0) e = 0; else f = 39; else f = 39;
   if ((f | 0) == 39) {
    f = 0;
    e = (a[c[g >> 2] >> 0] | 0) != 61;
   }
   b = c[g >> 2] | 0;
   if (!e) break;
   c[g >> 2] = b + 1;
  }
  c[j >> 2] = b - (c[n >> 2] | 0);
  c[m >> 2] = kh((c[j >> 2] | 0) + 1 | 0) | 0;
  Ai(c[m >> 2] | 0, c[n >> 2] | 0, c[j >> 2] | 0) | 0;
  a[(c[m >> 2] | 0) + (c[j >> 2] | 0) >> 0] = 0;
 }
 while (1) {
  if (hi(a[c[g >> 2] >> 0] | 0) | 0) e = (ni(d[c[g >> 2] >> 0] | 0) | 0) != 0; else e = 0;
  b = c[g >> 2] | 0;
  if (!e) break;
  c[g >> 2] = b + 1;
 }
 b : do if ((a[b >> 0] | 0) == 61) {
  c[g >> 2] = (c[g >> 2] | 0) + 1;
  while (1) {
   if (!(hi(a[c[g >> 2] >> 0] | 0) | 0)) break b;
   if (!(ni(d[c[g >> 2] >> 0] | 0) | 0)) break b;
   c[g >> 2] = (c[g >> 2] | 0) + 1;
  }
 } while (0);
 c[n >> 2] = c[g >> 2];
 c[j >> 2] = si(c[n >> 2] | 0) | 0;
 while (1) {
  if ((c[j >> 2] | 0) >>> 0 > 0) if (hi(a[(c[n >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] | 0) | 0) e = (ni(d[(c[n >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] | 0) | 0) != 0; else e = 0; else e = 0;
  b = c[j >> 2] | 0;
  if (!e) break;
  c[j >> 2] = b + -1;
 }
 c[o >> 2] = kh(b + 1 | 0) | 0;
 Ai(c[o >> 2] | 0, c[n >> 2] | 0, c[j >> 2] | 0) | 0;
 a[(c[o >> 2] | 0) + (c[j >> 2] | 0) >> 0] = 0;
 c[l >> 2] = c[o >> 2];
 while (1) {
  if (!(a[c[l >> 2] >> 0] | 0)) break;
  if ((a[c[l >> 2] >> 0] | 0) == 59) a[c[l >> 2] >> 0] = 58;
  c[l >> 2] = (c[l >> 2] | 0) + 1;
 }
 if (c[m >> 2] | 0) {
  c[k >> 2] = Ef(c[p >> 2] | 0, 34049, c[m >> 2] | 0) | 0;
  Cj(c[p >> 2] | 0);
  Cj(c[m >> 2] | 0);
  c[p >> 2] = c[k >> 2];
 }
 dg((c[h >> 2] | 0) + 8 | 0, c[p >> 2] | 0, c[o >> 2] | 0);
 i = q;
 return;
}

function rd() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 g = j + 24 | 0;
 f = j + 16 | 0;
 e = j + 8 | 0;
 b = j;
 h = j + 28 | 0;
 c[h >> 2] = 0;
 a : do switch (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) {
 case 123:
  {
   a[9382] = 125;
   if (!(qd() | 0)) {
    h = c[h >> 2] | 0;
    i = j;
    return h | 0;
   }
   break;
  }
 case 34:
  {
   a[9382] = 34;
   if (!(qd() | 0)) {
    h = c[h >> 2] | 0;
    i = j;
    return h | 0;
   }
   break;
  }
 case 57:
 case 56:
 case 55:
 case 54:
 case 53:
 case 52:
 case 51:
 case 50:
 case 49:
 case 48:
  {
   if (!(fd() | 0)) {
    Qi(12739, c[11] | 0) | 0;
    Qi(12739, c[12] | 0) | 0;
    wb();
    xa(96, 1);
   }
   if (c[340] | 0) {
    c[274] = c[66];
    while (1) {
     if ((c[274] | 0) >= (c[67] | 0)) break a;
     if ((c[273] | 0) == (c[14] | 0)) break;
     a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[15] | 0) + (c[274] | 0) >> 0] | 0;
     c[273] = (c[273] | 0) + 1;
     c[274] = (c[274] | 0) + 1;
    }
    oc();
    h = c[h >> 2] | 0;
    i = j;
    return h | 0;
   }
   break;
  }
 default:
  {
   ed(44, a[9383] | 0, 35);
   if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
    qc();
    Qi(12759, c[11] | 0) | 0;
    Qi(12759, c[12] | 0) | 0;
    hc();
    h = c[h >> 2] | 0;
    i = j;
    return h | 0;
   }
   if (c[340] | 0) {
    Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
    c[341] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 13, 0) | 0;
    c[342] = 1;
    if ((c[169] | 0) != 0 & (c[343] | 0) == 2) if ((c[341] | 0) == (c[344] | 0)) {
     c[342] = 0;
     pc();
     k = c[11] | 0;
     c[b >> 2] = 12772;
     $i(k, 16602, b) | 0;
     b = c[12] | 0;
     c[e >> 2] = 12772;
     $i(b, 16602, e) | 0;
     ic();
    }
    if (!(c[263] | 0)) {
     c[342] = 0;
     pc();
     k = c[11] | 0;
     c[f >> 2] = 12799;
     $i(k, 16602, f) | 0;
     k = c[12] | 0;
     c[g >> 2] = 12799;
     $i(k, 16602, g) | 0;
     ic();
    }
    if (c[342] | 0) {
     c[274] = c[(c[63] | 0) + (c[(c[271] | 0) + (c[341] << 2) >> 2] << 2) >> 2];
     c[275] = c[(c[63] | 0) + ((c[(c[271] | 0) + (c[341] << 2) >> 2] | 0) + 1 << 2) >> 2];
     b : do if (!(c[273] | 0)) if ((d[8613 + (d[(c[64] | 0) + (c[274] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) if ((c[274] | 0) < (c[275] | 0)) {
      if ((c[273] | 0) == (c[14] | 0)) {
       oc();
       k = c[h >> 2] | 0;
       i = j;
       return k | 0;
      }
      a[(c[17] | 0) + (c[273] | 0) >> 0] = 32;
      c[273] = (c[273] | 0) + 1;
      c[274] = (c[274] | 0) + 1;
      while (1) {
       if ((d[8613 + (d[(c[64] | 0) + (c[274] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) break b;
       if ((c[274] | 0) >= (c[275] | 0)) break b;
       c[274] = (c[274] | 0) + 1;
      }
     } while (0);
     while (1) {
      if ((c[274] | 0) >= (c[275] | 0)) break a;
      b = c[273] | 0;
      if ((d[8613 + (d[(c[64] | 0) + (c[274] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) {
       if ((b | 0) == (c[14] | 0)) {
        b = 34;
        break;
       }
       a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[274] | 0) >> 0] | 0;
       c[273] = (c[273] | 0) + 1;
      } else if ((d[(c[17] | 0) + (b - 1) >> 0] | 0 | 0) != 32) {
       if ((c[273] | 0) == (c[14] | 0)) {
        b = 38;
        break;
       }
       a[(c[17] | 0) + (c[273] | 0) >> 0] = 32;
       c[273] = (c[273] | 0) + 1;
      }
      c[274] = (c[274] | 0) + 1;
     }
     if ((b | 0) == 34) {
      oc();
      k = c[h >> 2] | 0;
      i = j;
      return k | 0;
     } else if ((b | 0) == 38) {
      oc();
      k = c[h >> 2] | 0;
      i = j;
      return k | 0;
     }
    }
   }
  }
 } while (0);
 if (od() | 0) {
  c[h >> 2] = 1;
  k = c[h >> 2] | 0;
  i = j;
  return k | 0;
 } else {
  kc();
  k = c[h >> 2] | 0;
  i = j;
  return k | 0;
 }
 return 0;
}

function pf(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0;
 q = i;
 i = i + 64 | 0;
 g = q + 48 | 0;
 h = q + 44 | 0;
 r = q + 40 | 0;
 k = q + 36 | 0;
 l = q + 32 | 0;
 p = q + 28 | 0;
 o = q + 24 | 0;
 j = q + 8 | 0;
 m = q + 4 | 0;
 n = q;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[r >> 2] = e;
 c[l >> 2] = 0;
 c[p >> 2] = 0;
 c[(c[h >> 2] | 0) + 28 >> 2] = c[r >> 2];
 c[j >> 2] = f;
 while (1) {
  f = (c[j >> 2] | 0) + (4 - 1) & ~(4 - 1);
  r = c[f >> 2] | 0;
  c[j >> 2] = f + 4;
  c[k >> 2] = r;
  if (!r) break;
  do if (!(c[p >> 2] | 0)) {
   c[m >> 2] = Ef(c[k >> 2] | 0, 34049, c[(c[g >> 2] | 0) + 112 >> 2] | 0) | 0;
   c[l >> 2] = Ka(c[m >> 2] | 0) | 0;
   if (c[l >> 2] | 0) if (a[c[l >> 2] >> 0] | 0) {
    c[p >> 2] = c[m >> 2];
    break;
   }
   Cj(c[m >> 2] | 0);
   c[m >> 2] = Ef(c[k >> 2] | 0, 28703, c[(c[g >> 2] | 0) + 112 >> 2] | 0) | 0;
   c[l >> 2] = Ka(c[m >> 2] | 0) | 0;
   if (c[l >> 2] | 0) if (a[c[l >> 2] >> 0] | 0) {
    c[p >> 2] = c[m >> 2];
    break;
   }
   Cj(c[m >> 2] | 0);
   c[l >> 2] = Ka(c[k >> 2] | 0) | 0;
   if (c[l >> 2] | 0) if (a[c[l >> 2] >> 0] | 0) c[p >> 2] = c[k >> 2];
  } while (0);
  if (!(c[(c[h >> 2] | 0) + 24 >> 2] | 0)) if ((c[h >> 2] | 0) != ((c[g >> 2] | 0) + 132 + 544 | 0)) {
   r = Af(c[g >> 2] | 0, c[k >> 2] | 0) | 0;
   c[(c[h >> 2] | 0) + 24 >> 2] = r;
  }
  if (!(c[p >> 2] | 0)) continue;
  if (c[(c[h >> 2] | 0) + 24 >> 2] | 0) break;
 }
 c[(c[h >> 2] | 0) + 8 >> 2] = c[(c[h >> 2] | 0) + 28 >> 2];
 r = nh(c[(c[h >> 2] | 0) + 8 >> 2] | 0) | 0;
 c[(c[h >> 2] | 0) + 4 >> 2] = r;
 c[(c[h >> 2] | 0) + 12 >> 2] = 19874;
 if (c[(c[h >> 2] | 0) + 24 >> 2] | 0) {
  c[(c[h >> 2] | 0) + 8 >> 2] = c[(c[h >> 2] | 0) + 24 >> 2];
  c[o >> 2] = c[(c[h >> 2] | 0) + 4 >> 2];
  r = kg(c[g >> 2] | 0, c[(c[h >> 2] | 0) + 24 >> 2] | 0, c[(c[h >> 2] | 0) + 4 >> 2] | 0) | 0;
  c[(c[h >> 2] | 0) + 4 >> 2] = r;
  Cj(c[o >> 2] | 0);
  c[(c[h >> 2] | 0) + 12 >> 2] = 20037;
 }
 if (c[(c[h >> 2] | 0) + 20 >> 2] | 0) {
  c[(c[h >> 2] | 0) + 8 >> 2] = c[(c[h >> 2] | 0) + 20 >> 2];
  c[o >> 2] = c[(c[h >> 2] | 0) + 4 >> 2];
  r = kg(c[g >> 2] | 0, c[(c[h >> 2] | 0) + 20 >> 2] | 0, c[(c[h >> 2] | 0) + 4 >> 2] | 0) | 0;
  c[(c[h >> 2] | 0) + 4 >> 2] = r;
  Cj(c[o >> 2] | 0);
  c[(c[h >> 2] | 0) + 12 >> 2] = 19895;
 }
 if (c[p >> 2] | 0) {
  c[l >> 2] = nh(c[l >> 2] | 0) | 0;
  c[n >> 2] = c[l >> 2];
  while (1) {
   if (!(a[c[n >> 2] >> 0] | 0)) break;
   if ((a[c[n >> 2] >> 0] | 0) == 59) a[c[n >> 2] >> 0] = 58;
   c[n >> 2] = (c[n >> 2] | 0) + 1;
  }
  if (c[l >> 2] | 0) {
   c[(c[h >> 2] | 0) + 8 >> 2] = c[l >> 2];
   c[o >> 2] = c[(c[h >> 2] | 0) + 4 >> 2];
   r = kg(c[g >> 2] | 0, c[l >> 2] | 0, c[(c[h >> 2] | 0) + 4 >> 2] | 0) | 0;
   c[(c[h >> 2] | 0) + 4 >> 2] = r;
   Cj(c[o >> 2] | 0);
   r = Df(c[p >> 2] | 0, 19915) | 0;
   c[(c[h >> 2] | 0) + 12 >> 2] = r;
  }
 }
 if (!(c[(c[h >> 2] | 0) + 16 >> 2] | 0)) {
  r = c[h >> 2] | 0;
  r = r + 4 | 0;
  r = c[r >> 2] | 0;
  c[o >> 2] = r;
  r = c[g >> 2] | 0;
  f = c[h >> 2] | 0;
  f = f + 4 | 0;
  f = c[f >> 2] | 0;
  f = Tf(r, f) | 0;
  r = c[h >> 2] | 0;
  r = r + 4 | 0;
  c[r >> 2] = f;
  r = c[o >> 2] | 0;
  Cj(r);
  i = q;
  return;
 }
 c[(c[h >> 2] | 0) + 8 >> 2] = c[(c[h >> 2] | 0) + 16 >> 2];
 c[o >> 2] = c[(c[h >> 2] | 0) + 4 >> 2];
 r = kg(c[g >> 2] | 0, c[(c[h >> 2] | 0) + 16 >> 2] | 0, c[(c[h >> 2] | 0) + 4 >> 2] | 0) | 0;
 c[(c[h >> 2] | 0) + 4 >> 2] = r;
 Cj(c[o >> 2] | 0);
 c[(c[h >> 2] | 0) + 12 >> 2] = 19937;
 r = c[h >> 2] | 0;
 r = r + 4 | 0;
 r = c[r >> 2] | 0;
 c[o >> 2] = r;
 r = c[g >> 2] | 0;
 f = c[h >> 2] | 0;
 f = f + 4 | 0;
 f = c[f >> 2] | 0;
 f = Tf(r, f) | 0;
 r = c[h >> 2] | 0;
 r = r + 4 | 0;
 c[r >> 2] = f;
 r = c[o >> 2] | 0;
 Cj(r);
 i = q;
 return;
}

function Cg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0;
 v = i;
 i = i + 8416 | 0;
 r = v + 104 | 0;
 q = v + 80 | 0;
 p = v + 56 | 0;
 o = v + 32 | 0;
 s = v + 8 | 0;
 u = v;
 t = v + 212 | 0;
 e = v + 208 | 0;
 w = v + 204 | 0;
 k = v + 6368 | 0;
 m = v + 4320 | 0;
 n = v + 2272 | 0;
 g = v + 224 | 0;
 h = v + 200 | 0;
 f = v + 216 | 0;
 l = v + 124 | 0;
 j = v + 120 | 0;
 c[e >> 2] = b;
 c[w >> 2] = d;
 zi(k, c[w >> 2] | 0) | 0;
 zi(21605, 28601) | 0;
 while (1) {
  if (!(si(k) | 0)) {
   b = 58;
   break;
  }
  Fg(21605, k);
  if (Th(21605, l) | 0) {
   b = 4;
   break;
  }
  if ((c[l + 12 >> 2] & 61440 | 0) != 40960) continue;
  Gg(21605, m);
  if (qi(m, 29173, 1) | 0) {
   a[f >> 0] = a[21605] | 0;
   zi(n, Hg(21605) | 0) | 0;
   if (!(si(21605) | 0)) if ((a[f >> 0] | 0) == 47) zi(21605, 29173) | 0;
   if (c[(c[e >> 2] | 0) + 116 >> 2] | 0) {
    if (si(21605) | 0) b = (Ci(21605, 29173) | 0) != 0; else b = 0;
    if (si(k) | 0) d = (Ci(k, 29173) | 0) != 0; else d = 0;
    c[o >> 2] = 21605;
    c[o + 4 >> 2] = b ? 29173 : 28601;
    c[o + 8 >> 2] = n;
    c[o + 12 >> 2] = d ? 29173 : 28601;
    c[o + 16 >> 2] = k;
    Xi(g, 23697, o) | 0;
    if (si(21605) | 0) b = (Ci(21605, 29173) | 0) != 0; else b = 0;
    if (si(k) | 0) d = (Ci(k, 29173) | 0) != 0; else d = 0;
    c[p >> 2] = g;
    c[p + 4 >> 2] = 21605;
    c[p + 8 >> 2] = b ? 29173 : 28601;
    c[p + 12 >> 2] = m;
    c[p + 16 >> 2] = d ? 29173 : 28601;
    c[p + 20 >> 2] = k;
    lj(23710, p) | 0;
   }
   c[j >> 2] = 0;
   a[f >> 0] = a[21605] | 0;
   while (1) {
    if (qi(m, 21586, 2) | 0) break;
    if (a[m + 2 >> 0] | 0) if ((a[m + 2 >> 0] | 0) != 47) break;
    if (!(si(21605) | 0)) break;
    if (!(Ci(21605, 34049) | 0)) break;
    if (!(Ci(21605, 21586) | 0)) break;
    if ((si(21605) | 0) >>> 0 >= 3) if (!(Ci(21605 + (si(21605) | 0) + -3 | 0, 23730) | 0)) break;
    c[j >> 2] = 1;
    Ig(m) | 0;
    Hg(21605) | 0;
   }
   do if (c[j >> 2] | 0) if (c[(c[e >> 2] | 0) + 116 >> 2] | 0) {
    c[h >> 2] = g;
    while (1) {
     if (!(a[c[h >> 2] >> 0] | 0)) break;
     w = c[h >> 2] | 0;
     c[h >> 2] = w + 1;
     a[w >> 0] = 32;
    }
    if (!(si(m) | 0)) {
     if (si(k) | 0) b = (Ci(k, 29173) | 0) != 0; else b = 0;
     c[r >> 2] = g;
     c[r + 4 >> 2] = 21605;
     c[r + 8 >> 2] = b ? 29173 : 28601;
     c[r + 12 >> 2] = k;
     lj(23752, r) | 0;
     break;
    }
    if (si(21605) | 0) b = (Ci(21605, 29173) | 0) != 0; else b = 0;
    if (si(k) | 0) d = (Ci(k, 29173) | 0) != 0; else d = 0;
    c[q >> 2] = g;
    c[q + 4 >> 2] = 21605;
    c[q + 8 >> 2] = b ? 29173 : 28601;
    c[q + 12 >> 2] = m;
    c[q + 16 >> 2] = d ? 29173 : 28601;
    c[q + 20 >> 2] = k;
    lj(23734, q) | 0;
   } while (0);
   if (!(si(21605) | 0)) if ((a[f >> 0] | 0) == 47) zi(21605, 29173) | 0;
  } else {
   if (c[(c[e >> 2] | 0) + 116 >> 2] | 0) {
    if (si(k) | 0) b = (Ci(k, 29173) | 0) != 0; else b = 0;
    if (si(k) | 0) d = (Ci(k, 29173) | 0) != 0; else d = 0;
    c[s >> 2] = 21605;
    c[s + 4 >> 2] = b ? 29173 : 28601;
    c[s + 8 >> 2] = k;
    c[s + 12 >> 2] = m;
    c[s + 16 >> 2] = d ? 29173 : 28601;
    c[s + 20 >> 2] = k;
    lj(23675, s) | 0;
   }
   zi(21605, 28601) | 0;
  }
  if (si(k) | 0) if (si(m) | 0) pi(m, 29173) | 0;
  pi(m, k) | 0;
  zi(k, m) | 0;
 }
 if ((b | 0) == 4) {
  w = c[1840] | 0;
  c[u >> 2] = 21605;
  $i(w, 23653, u) | 0;
  Li(21605);
  c[t >> 2] = 0;
  w = c[t >> 2] | 0;
  i = v;
  return w | 0;
 } else if ((b | 0) == 58) {
  c[t >> 2] = 21605;
  w = c[t >> 2] | 0;
  i = v;
  return w | 0;
 }
 return 0;
}

function Xg(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0, y = 0, z = 0;
 z = i;
 i = i + 1136 | 0;
 v = z + 32 | 0;
 q = z + 24 | 0;
 p = z + 16 | 0;
 o = z + 8 | 0;
 s = z + 92 | 0;
 w = z + 88 | 0;
 x = z + 84 | 0;
 u = z + 80 | 0;
 n = z + 76 | 0;
 y = z + 72 | 0;
 t = z + 68 | 0;
 h = z + 64 | 0;
 j = z + 56 | 0;
 g = z + 52 | 0;
 k = z + 48 | 0;
 f = z + 96 | 0;
 m = z + 44 | 0;
 l = z + 40 | 0;
 c[s >> 2] = b;
 c[w >> 2] = d;
 c[x >> 2] = e;
 c[y >> 2] = 0;
 if (!(c[(c[s >> 2] | 0) + 4144 >> 2] | 0)) {
  $i(c[1840] | 0, 28006, z) | 0;
  c[n >> 2] = c[x >> 2];
  while (1) {
   e = c[1840] | 0;
   if (!(c[c[n >> 2] >> 2] | 0)) break;
   c[o >> 2] = c[c[n >> 2] >> 2];
   $i(e, 29169, o) | 0;
   c[n >> 2] = (c[n >> 2] | 0) + 4;
  }
  Ki(10, e) | 0;
 }
 p = Ph(28025, 0, p) | 0;
 c[h >> 2] = p;
 a : do if ((p | 0) < 0) {
  Li(28035);
  r = 16;
 } else {
  if ((Vh(j) | 0) < 0) Li(28073); else {
   q = Ph(28025, 1, q) | 0;
   c[g >> 2] = q;
   do if ((q | 0) < 0) Li(28090); else {
    q = sa() | 0;
    c[k >> 2] = q;
    if ((q | 0) < 0) {
     Li(28128);
     ai(c[g >> 2] | 0) | 0;
     break;
    }
    if (c[k >> 2] | 0) {
     ai(c[h >> 2] | 0) | 0;
     ai(c[j + 4 >> 2] | 0) | 0;
     ai(c[g >> 2] | 0) | 0;
     c[t >> 2] = nh(28601) | 0;
     while (1) {
      q = _h(c[j >> 2] | 0, f, 1024) | 0;
      c[m >> 2] = q;
      if (!q) break;
      if ((c[m >> 2] | 0) == -1) if ((c[(Hi() | 0) >> 2] | 0) != 4) {
       r = 33;
       break;
      } else continue; else {
       a[f + (c[m >> 2] | 0) >> 0] = 0;
       c[l >> 2] = Df(c[t >> 2] | 0, f) | 0;
       Cj(c[t >> 2] | 0);
       c[t >> 2] = c[l >> 2];
       continue;
      }
     }
     if ((r | 0) == 33) Li(28145);
     ai(c[j >> 2] | 0) | 0;
     Aa(0) | 0;
     break a;
    }
    ai(c[j >> 2] | 0) | 0;
    if (c[h >> 2] | 0) {
     ai(0) | 0;
     Yh(c[h >> 2] | 0) | 0;
     ai(c[h >> 2] | 0) | 0;
    }
    if ((c[j + 4 >> 2] | 0) != 1) {
     ai(1) | 0;
     Yh(c[j + 4 >> 2] | 0) | 0;
     ai(c[j + 4 >> 2] | 0) | 0;
    }
    if ((c[g >> 2] | 0) != 2) {
     if (c[(c[s >> 2] | 0) + 4144 >> 2] | 0) {
      ai(2) | 0;
      Yh(c[g >> 2] | 0) | 0;
     }
     ai(c[g >> 2] | 0) | 0;
    }
    if (!(pa(c[c[x >> 2] >> 2] | 0, c[x >> 2] | 0) | 0)) ci(1);
    Li(c[c[x >> 2] >> 2] | 0);
    ci(1);
   } while (0);
   ai(c[j >> 2] | 0) | 0;
   ai(c[j + 4 >> 2] | 0) | 0;
  }
  ai(c[h >> 2] | 0) | 0;
  r = 16;
 } while (0);
 if ((r | 0) == 16) c[t >> 2] = 0;
 if (c[t >> 2] | 0) {
  c[u >> 2] = si(c[t >> 2] | 0) | 0;
  while (1) {
   if (c[u >> 2] | 0) if ((a[(c[t >> 2] | 0) + ((c[u >> 2] | 0) - 1) >> 0] | 0) == 10) e = 1; else e = (a[(c[t >> 2] | 0) + ((c[u >> 2] | 0) - 1) >> 0] | 0) == 13; else e = 0;
   d = c[u >> 2] | 0;
   if (!e) break;
   a[(c[t >> 2] | 0) + (d - 1) >> 0] = 0;
   c[u >> 2] = (c[u >> 2] | 0) + -1;
  }
  if (!d) e = 0; else e = Jg(c[s >> 2] | 0, c[t >> 2] | 0) | 0;
  c[y >> 2] = e;
  if ((c[y >> 2] | 0) == 0 & (c[u >> 2] | 0) >>> 0 > 1) {
   Qi(28730, c[1840] | 0) | 0;
   u = c[1840] | 0;
   r = c[t >> 2] | 0;
   c[v >> 2] = c[c[x >> 2] >> 2];
   c[v + 4 >> 2] = r;
   $i(u, 28162, v) | 0;
   Qi(29463, c[1840] | 0) | 0;
   ij(c[1840] | 0) | 0;
  }
  if ((c[t >> 2] | 0) != (c[y >> 2] | 0)) Cj(c[t >> 2] | 0);
 }
 e = c[s >> 2] | 0;
 if (!(c[y >> 2] | 0)) {
  Yg(e, c[w >> 2] | 0, c[x >> 2] | 0);
  y = c[y >> 2] | 0;
  i = z;
  return y | 0;
 } else {
  Gf(e, c[y >> 2] | 0);
  y = c[y >> 2] | 0;
  i = z;
  return y | 0;
 }
 return 0;
}

function Zj(a, b, d, e, f) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0;
 l = a;
 j = b;
 k = j;
 h = d;
 n = e;
 i = n;
 if (!k) {
  g = (f | 0) != 0;
  if (!i) {
   if (g) {
    c[f >> 2] = (l >>> 0) % (h >>> 0);
    c[f + 4 >> 2] = 0;
   }
   n = 0;
   f = (l >>> 0) / (h >>> 0) >>> 0;
   return (C = n, f) | 0;
  } else {
   if (!g) {
    n = 0;
    f = 0;
    return (C = n, f) | 0;
   }
   c[f >> 2] = a | 0;
   c[f + 4 >> 2] = b & 0;
   n = 0;
   f = 0;
   return (C = n, f) | 0;
  }
 }
 g = (i | 0) == 0;
 do if (!h) {
  if (g) {
   if (f) {
    c[f >> 2] = (k >>> 0) % (h >>> 0);
    c[f + 4 >> 2] = 0;
   }
   n = 0;
   f = (k >>> 0) / (h >>> 0) >>> 0;
   return (C = n, f) | 0;
  }
  if (!l) {
   if (f) {
    c[f >> 2] = 0;
    c[f + 4 >> 2] = (k >>> 0) % (i >>> 0);
   }
   n = 0;
   f = (k >>> 0) / (i >>> 0) >>> 0;
   return (C = n, f) | 0;
  }
  g = i - 1 | 0;
  if (!(g & i)) {
   if (f) {
    c[f >> 2] = a | 0;
    c[f + 4 >> 2] = g & k | b & 0;
   }
   n = 0;
   f = k >>> ((Sj(i | 0) | 0) >>> 0);
   return (C = n, f) | 0;
  }
  g = (aa(i | 0) | 0) - (aa(k | 0) | 0) | 0;
  if (g >>> 0 <= 30) {
   b = g + 1 | 0;
   i = 31 - g | 0;
   h = b;
   a = k << i | l >>> (b >>> 0);
   b = k >>> (b >>> 0);
   g = 0;
   i = l << i;
   break;
  }
  if (!f) {
   n = 0;
   f = 0;
   return (C = n, f) | 0;
  }
  c[f >> 2] = a | 0;
  c[f + 4 >> 2] = j | b & 0;
  n = 0;
  f = 0;
  return (C = n, f) | 0;
 } else {
  if (!g) {
   g = (aa(i | 0) | 0) - (aa(k | 0) | 0) | 0;
   if (g >>> 0 <= 31) {
    m = g + 1 | 0;
    i = 31 - g | 0;
    b = g - 31 >> 31;
    h = m;
    a = l >>> (m >>> 0) & b | k << i;
    b = k >>> (m >>> 0) & b;
    g = 0;
    i = l << i;
    break;
   }
   if (!f) {
    n = 0;
    f = 0;
    return (C = n, f) | 0;
   }
   c[f >> 2] = a | 0;
   c[f + 4 >> 2] = j | b & 0;
   n = 0;
   f = 0;
   return (C = n, f) | 0;
  }
  g = h - 1 | 0;
  if (g & h) {
   i = (aa(h | 0) | 0) + 33 - (aa(k | 0) | 0) | 0;
   p = 64 - i | 0;
   m = 32 - i | 0;
   j = m >> 31;
   o = i - 32 | 0;
   b = o >> 31;
   h = i;
   a = m - 1 >> 31 & k >>> (o >>> 0) | (k << m | l >>> (i >>> 0)) & b;
   b = b & k >>> (i >>> 0);
   g = l << p & j;
   i = (k << p | l >>> (o >>> 0)) & j | l << m & i - 33 >> 31;
   break;
  }
  if (f) {
   c[f >> 2] = g & l;
   c[f + 4 >> 2] = 0;
  }
  if ((h | 0) == 1) {
   o = j | b & 0;
   p = a | 0 | 0;
   return (C = o, p) | 0;
  } else {
   p = Sj(h | 0) | 0;
   o = k >>> (p >>> 0) | 0;
   p = k << 32 - p | l >>> (p >>> 0) | 0;
   return (C = o, p) | 0;
  }
 } while (0);
 if (!h) {
  k = i;
  j = 0;
  i = 0;
 } else {
  m = d | 0 | 0;
  l = n | e & 0;
  k = Lj(m | 0, l | 0, -1, -1) | 0;
  d = C;
  j = i;
  i = 0;
  do {
   e = j;
   j = g >>> 31 | j << 1;
   g = i | g << 1;
   e = a << 1 | e >>> 31 | 0;
   n = a >>> 31 | b << 1 | 0;
   Ij(k, d, e, n) | 0;
   p = C;
   o = p >> 31 | ((p | 0) < 0 ? -1 : 0) << 1;
   i = o & 1;
   a = Ij(e, n, o & m, (((p | 0) < 0 ? -1 : 0) >> 31 | ((p | 0) < 0 ? -1 : 0) << 1) & l) | 0;
   b = C;
   h = h - 1 | 0;
  } while ((h | 0) != 0);
  k = j;
  j = 0;
 }
 h = 0;
 if (f) {
  c[f >> 2] = a;
  c[f + 4 >> 2] = b;
 }
 o = (g | 0) >>> 31 | (k | h) << 1 | (h << 1 | g >>> 31) & 0 | j;
 p = (g << 1 | 0 >>> 31) & -2 | i;
 return (C = o, p) | 0;
}

function Sd() {
 var b = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 32 | 0;
 e = h + 24 | 0;
 g = h + 16 | 0;
 f = h + 8 | 0;
 b = h;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if ((d[9384] | 0 | 0) != 2) {
  Ed(c[367] | 0, a[9384] | 0, 2);
  i = h;
  return;
 }
 do if (!(c[174] | 0)) {
  if ((d[(c[166] | 0) + (c[367] | 0) >> 0] | 0 | 0) != 6) if ((d[(c[166] | 0) + (c[367] | 0) >> 0] | 0 | 0) != 5) break;
  yc();
  i = h;
  return;
 } while (0);
 switch (d[(c[166] | 0) + (c[367] | 0) >> 0] | 0 | 0) {
 case 5:
  {
   b = c[387] | 0;
   if (d[9385] | 0) {
    Ed(b, a[9385] | 0, 0);
    i = h;
    return;
   } else {
    g = _(c[172] | 0, c[390] | 0) | 0;
    c[(c[391] | 0) + (g + (c[(c[271] | 0) + (c[367] << 2) >> 2] | 0) << 2) >> 2] = b;
    i = h;
    return;
   }
  }
 case 6:
  {
   if ((d[9385] | 0 | 0) != 1) {
    Ed(c[387] | 0, a[9385] | 0, 1);
    i = h;
    return;
   }
   c[392] = (_(c[172] | 0, c[277] | 0) | 0) + (c[(c[271] | 0) + (c[367] << 2) >> 2] | 0);
   c[393] = 0;
   c[365] = c[(c[63] | 0) + (c[387] << 2) >> 2];
   c[370] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
   if (((c[370] | 0) - (c[365] | 0) | 0) > (c[279] | 0)) {
    Ec();
    g = c[11] | 0;
    c[b >> 2] = c[279];
    c[b + 4 >> 2] = 13269;
    $i(g, 10933, b) | 0;
    g = c[12] | 0;
    c[f >> 2] = c[279];
    c[f + 4 >> 2] = 13269;
    $i(g, 10933, f) | 0;
    Fc();
    c[370] = (c[365] | 0) + (c[279] | 0);
   }
   while (1) {
    if ((c[365] | 0) >= (c[370] | 0)) break;
    g = _(c[392] | 0, (c[279] | 0) + 1 | 0) | 0;
    a[(c[280] | 0) + (g + (c[393] | 0)) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
    c[393] = (c[393] | 0) + 1;
    c[365] = (c[365] | 0) + 1;
   }
   g = _(c[392] | 0, (c[279] | 0) + 1 | 0) | 0;
   a[(c[280] | 0) + (g + (c[393] | 0)) >> 0] = 127;
   i = h;
   return;
  }
 case 7:
  {
   b = c[387] | 0;
   if (d[9385] | 0) {
    Ed(b, a[9385] | 0, 0);
    i = h;
    return;
   } else {
    c[(c[271] | 0) + (c[367] << 2) >> 2] = b;
    i = h;
    return;
   }
  }
 case 8:
  {
   if ((d[9385] | 0 | 0) != 1) {
    Ed(c[387] | 0, a[9385] | 0, 1);
    i = h;
    return;
   }
   c[394] = c[(c[271] | 0) + (c[367] << 2) >> 2];
   if ((c[387] | 0) < (c[386] | 0)) {
    c[(c[395] | 0) + (c[394] << 2) >> 2] = c[387];
    i = h;
    return;
   }
   c[(c[395] | 0) + (c[394] << 2) >> 2] = 0;
   c[396] = 0;
   c[365] = c[(c[63] | 0) + (c[387] << 2) >> 2];
   c[366] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
   if (((c[366] | 0) - (c[365] | 0) | 0) > (c[329] | 0)) {
    Ec();
    f = c[11] | 0;
    c[g >> 2] = c[329];
    c[g + 4 >> 2] = 13281;
    $i(f, 10933, g) | 0;
    g = c[12] | 0;
    c[e >> 2] = c[329];
    c[e + 4 >> 2] = 13281;
    $i(g, 10933, e) | 0;
    Fc();
    c[366] = (c[365] | 0) + (c[329] | 0);
   }
   while (1) {
    if ((c[365] | 0) >= (c[366] | 0)) break;
    g = _(c[394] | 0, (c[329] | 0) + 1 | 0) | 0;
    a[(c[397] | 0) + (g + (c[396] | 0)) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
    c[396] = (c[396] | 0) + 1;
    c[365] = (c[365] | 0) + 1;
   }
   c[(c[398] | 0) + (c[394] << 2) >> 2] = c[396];
   i = h;
   return;
  }
 default:
  {
   Qi(13294, c[11] | 0) | 0;
   Qi(13294, c[12] | 0) | 0;
   ac(c[367] | 0);
   Qi(13320, c[11] | 0) | 0;
   Qi(13320, c[12] | 0) | 0;
   wc();
   i = h;
   return;
  }
 }
}

function sd() {
 var b = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 f = h + 8 | 0;
 e = h;
 b = h + 12 | 0;
 c[b >> 2] = 0;
 c[273] = 0;
 if (!(rd() | 0)) {
  g = c[b >> 2] | 0;
  i = h;
  return g | 0;
 }
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 35) {
   g = 6;
   break;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(od() | 0)) {
   g = 4;
   break;
  }
  if (!(rd() | 0)) {
   g = 34;
   break;
  }
 }
 if ((g | 0) == 4) {
  kc();
  g = c[b >> 2] | 0;
  i = h;
  return g | 0;
 } else if ((g | 0) == 6) {
  a : do if (c[340] | 0) {
   if ((c[169] | 0) == 0 & (c[273] | 0) > 0) if ((d[(c[17] | 0) + ((c[273] | 0) - 1) >> 0] | 0 | 0) == 32) c[273] = (c[273] | 0) - 1;
   if (c[169] | 0) g = 13; else if ((c[273] | 0) > 0 ? (d[c[17] >> 0] | 0 | 0) == 32 : 0) c[345] = 1; else g = 13;
   if ((g | 0) == 13) c[345] = 0;
   c[346] = Qc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0, 0, 1) | 0;
   a[(c[166] | 0) + (c[346] | 0) >> 0] = 3;
   if (c[169] | 0) switch (c[343] | 0) {
   case 1:
    {
     c[(c[347] | 0) + (c[326] << 2) >> 2] = c[(c[167] | 0) + (c[346] << 2) >> 2];
     c[326] = (c[326] | 0) + 1;
     break a;
    }
   case 2:
    {
     c[(c[271] | 0) + (c[344] << 2) >> 2] = c[(c[167] | 0) + (c[346] << 2) >> 2];
     break a;
    }
   default:
    {
     rc();
     break a;
    }
   }
   g = _(c[348] | 0, c[269] | 0) | 0;
   c[173] = g + (c[(c[271] | 0) + (c[349] << 2) >> 2] | 0);
   if ((c[173] | 0) >= (c[170] | 0)) {
    Qi(12809, c[11] | 0) | 0;
    Qi(12809, c[12] | 0) | 0;
    wb();
    xa(96, 1);
   }
   if (c[(c[171] | 0) + (c[173] << 2) >> 2] | 0) {
    Qi(12842, c[11] | 0) | 0;
    Qi(12842, c[12] | 0) | 0;
    Ab(c[(c[121] | 0) + (c[348] << 2) >> 2] | 0);
    Qi(12865, c[11] | 0) | 0;
    Qi(12865, c[12] | 0) | 0;
    Ab(c[(c[167] | 0) + (c[349] << 2) >> 2] | 0);
    g = c[11] | 0;
    c[e >> 2] = 12876;
    $i(g, 16602, e) | 0;
    g = c[12] | 0;
    c[f >> 2] = 12876;
    $i(g, 16602, f) | 0;
    ic();
    break;
   }
   c[(c[171] | 0) + (c[173] << 2) >> 2] = c[(c[167] | 0) + (c[346] << 2) >> 2];
   if (!((c[350] | 0) != 0 ? 1 : (c[(c[271] | 0) + (c[349] << 2) >> 2] | 0) != (c[327] | 0))) {
    c[274] = c[345];
    while (1) {
     if ((c[274] | 0) >= (c[273] | 0)) break;
     a[(c[18] | 0) + (c[274] | 0) >> 0] = a[(c[17] | 0) + (c[274] | 0) >> 0] | 0;
     c[274] = (c[274] | 0) + 1;
    }
    Oc(c[18] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0);
    c[272] = Qc(c[18] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0, 10, 1) | 0;
    if (c[263] | 0) {
     c[270] = c[(c[271] | 0) + (c[272] << 2) >> 2];
     if ((c[(c[271] | 0) + (c[270] << 2) >> 2] | 0) < (c[351] | 0)) break;
     c[(c[124] | 0) + (c[(c[271] | 0) + (c[270] << 2) >> 2] << 2) >> 2] = (c[(c[124] | 0) + (c[(c[271] | 0) + (c[270] << 2) >> 2] << 2) >> 2] | 0) + 1;
     break;
    }
    c[270] = Qc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0, 9, 1) | 0;
    if (c[263] | 0) Tb();
    Tc(688);
    c[(c[124] | 0) + (c[(c[271] | 0) + (c[270] << 2) >> 2] << 2) >> 2] = 1;
   }
  } while (0);
  c[b >> 2] = 1;
  g = c[b >> 2] | 0;
  i = h;
  return g | 0;
 } else if ((g | 0) == 34) {
  g = c[b >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function Lf(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0;
 v = i;
 i = i + 80 | 0;
 f = v + 8 | 0;
 t = v;
 g = v + 68 | 0;
 h = v + 64 | 0;
 j = v + 60 | 0;
 r = v + 56 | 0;
 m = v + 52 | 0;
 n = v + 48 | 0;
 p = v + 44 | 0;
 q = v + 40 | 0;
 s = v + 36 | 0;
 k = v + 32 | 0;
 l = v + 28 | 0;
 o = v + 24 | 0;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[m >> 2] = 0;
 c[n >> 2] = 0;
 c[p >> 2] = 0;
 c[q >> 2] = (si(c[j >> 2] | 0) | 0) - 5 + 1;
 c[s >> 2] = kh((c[q >> 2] | 0) + 1 | 0) | 0;
 c[k >> 2] = 0;
 c[l >> 2] = Qf(c[j >> 2] | 0, 20591) | 0;
 Ai(c[s >> 2] | 0, c[j >> 2] | 0, c[q >> 2] | 0) | 0;
 a[(c[s >> 2] | 0) + (c[q >> 2] | 0) >> 0] = 0;
 if (!(c[l >> 2] | 0)) {
  u = c[s >> 2] | 0;
  Cj(u);
  u = c[l >> 2] | 0;
  u = (u | 0) != 0;
  u = u & 1;
  i = v;
  return u | 0;
 }
 while (1) {
  d = lg(c[l >> 2] | 0) | 0;
  c[r >> 2] = d;
  if (!d) break;
  c[q >> 2] = si(c[r >> 2] | 0) | 0;
  do if ((c[q >> 2] | 0) >>> 0 > 0) if ((a[(c[r >> 2] | 0) + ((c[q >> 2] | 0) - 1) >> 0] | 0) == 58) if (yf(c[g >> 2] | 0, c[r >> 2] | 0, 1) | 0) {
   if (Pf(c[r >> 2] | 0) | 0) {
    c[k >> 2] = 0;
    c[p >> 2] = (c[p >> 2] | 0) + 1;
    break;
   }
   a[(c[r >> 2] | 0) + ((c[q >> 2] | 0) - 1) >> 0] = 47;
   if ((a[c[r >> 2] >> 0] | 0) == 46) e = Df(c[s >> 2] | 0, (c[r >> 2] | 0) + 2 | 0) | 0; else e = nh(c[r >> 2] | 0) | 0;
   c[k >> 2] = e;
   c[m >> 2] = (c[m >> 2] | 0) + 1;
  } else u = 12; else u = 12; else u = 12; while (0);
  do if ((u | 0) == 12) {
   u = 0;
   if ((c[k >> 2] | 0) != 0 ? (a[c[r >> 2] >> 0] | 0) != 0 : 0) {
    if ((a[c[r >> 2] >> 0] | 0) == 46) {
     if (!(a[(c[r >> 2] | 0) + 1 >> 0] | 0)) break;
     if ((a[(c[r >> 2] | 0) + 1 >> 0] | 0) == 46) if (!(a[(c[r >> 2] | 0) + 2 >> 0] | 0)) break;
    }
    b = c[h >> 2] | 0;
    d = nh(c[r >> 2] | 0) | 0;
    eg(b, d, c[k >> 2] | 0);
    c[n >> 2] = (c[n >> 2] | 0) + 1;
   }
  } while (0);
  Cj(c[r >> 2] | 0);
 }
 ih(c[l >> 2] | 0, c[j >> 2] | 0);
 if (!(c[n >> 2] | 0)) {
  Qi(28730, c[1840] | 0) | 0;
  u = c[1840] | 0;
  c[t >> 2] = c[j >> 2];
  $i(u, 20332, t) | 0;
  Qi(29463, c[1840] | 0) | 0;
  ij(c[1840] | 0) | 0;
  Qi(28730, c[1840] | 0) | 0;
  Qi(20372, c[1840] | 0) | 0;
  Qi(29463, c[1840] | 0) | 0;
  ij(c[1840] | 0) | 0;
  c[l >> 2] = 0;
 } else {
  u = (c[g >> 2] | 0) + 36 | 0;
  Lg(u, nh(c[s >> 2] | 0) | 0);
 }
 if (!(c[(c[g >> 2] | 0) + 44 >> 2] & 2)) {
  u = c[s >> 2] | 0;
  Cj(u);
  u = c[l >> 2] | 0;
  u = (u | 0) != 0;
  u = u & 1;
  i = v;
  return u | 0;
 }
 c[o >> 2] = 1;
 Qi(29466, c[1840] | 0) | 0;
 t = c[1840] | 0;
 q = c[n >> 2] | 0;
 r = c[m >> 2] | 0;
 u = c[p >> 2] | 0;
 c[f >> 2] = c[j >> 2];
 c[f + 4 >> 2] = q;
 c[f + 8 >> 2] = r;
 c[f + 12 >> 2] = u;
 $i(t, 20422, f) | 0;
 ij(c[1840] | 0) | 0;
 Qi(29466, c[1840] | 0) | 0;
 Qi(20469, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 t = c[h >> 2] | 0;
 u = c[o >> 2] | 0;
 c[f >> 2] = c[t >> 2];
 c[f + 4 >> 2] = c[t + 4 >> 2];
 gg(f, u);
 ij(c[1840] | 0) | 0;
 u = c[s >> 2] | 0;
 Cj(u);
 u = c[l >> 2] | 0;
 u = (u | 0) != 0;
 u = u & 1;
 i = v;
 return u | 0;
}

function le() {
 var b = 0, e = 0, f = 0;
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(0, 0);
  return;
 }
 c[355] = 0;
 Kd(c[367] | 0);
 c[409] = 0;
 c[352] = 0;
 c[273] = 0;
 while (1) {
  if ((c[273] | 0) >= (c[355] | 0)) break;
  do if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 123) {
   c[352] = (c[352] | 0) + 1;
   if ((c[352] | 0) == 1) if (((c[273] | 0) + 1 | 0) < (c[355] | 0)) {
    if ((d[(c[17] | 0) + ((c[273] | 0) + 1) >> 0] | 0 | 0) != 92) {
     c[409] = (c[409] | 0) + (c[533] | 0);
     break;
    }
    c[273] = (c[273] | 0) + 1;
    a : while (1) {
     b = c[273] | 0;
     if (!((c[273] | 0) < (c[355] | 0) ? (c[352] | 0) > 0 : 0)) break;
     c[273] = b + 1;
     c[345] = c[273];
     while (1) {
      if ((c[273] | 0) < (c[355] | 0)) b = (d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) == 2; else b = 0;
      e = c[273] | 0;
      if (!b) break;
      c[273] = e + 1;
     }
     if ((e | 0) < (c[355] | 0)) if ((c[273] | 0) == (c[345] | 0)) c[273] = (c[273] | 0) + 1; else f = 19; else f = 19;
     b : do if ((f | 0) == 19) {
      f = 0;
      c[360] = Qc(c[17] | 0, c[345] | 0, (c[273] | 0) - (c[345] | 0) | 0, 14, 0) | 0;
      if (c[263] | 0) switch (c[(c[271] | 0) + (c[360] << 2) >> 2] | 0) {
      case 12:
       {
        c[409] = (c[409] | 0) + 500;
        break b;
       }
      case 4:
       {
        c[409] = (c[409] | 0) + 722;
        break b;
       }
      case 2:
       {
        c[409] = (c[409] | 0) + 778;
        break b;
       }
      case 5:
       {
        c[409] = (c[409] | 0) + 903;
        break b;
       }
      case 3:
       {
        c[409] = (c[409] | 0) + 1014;
        break b;
       }
      default:
       {
        c[409] = (c[409] | 0) + (c[1640 + ((d[(c[17] | 0) + (c[345] | 0) >> 0] | 0) << 2) >> 2] | 0);
        break b;
       }
      }
     } while (0);
     while (1) {
      if ((c[273] | 0) >= (c[355] | 0)) break;
      if ((d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) break;
      c[273] = (c[273] | 0) + 1;
     }
     while (1) {
      if (!((c[352] | 0) > 0 ? (c[273] | 0) < (c[355] | 0) : 0)) continue a;
      if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 92) continue a;
      do if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; else if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 123) {
       c[352] = (c[352] | 0) + 1;
       break;
      } else {
       c[409] = (c[409] | 0) + (c[1640 + ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) << 2) >> 2] | 0);
       break;
      } while (0);
      c[273] = (c[273] | 0) + 1;
     }
    }
    c[273] = b - 1;
    break;
   }
   c[409] = (c[409] | 0) + (c[533] | 0);
  } else if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125) {
   td(c[367] | 0);
   c[409] = (c[409] | 0) + (c[535] | 0);
   break;
  } else {
   c[409] = (c[409] | 0) + (c[1640 + ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) << 2) >> 2] | 0);
   break;
  } while (0);
  c[273] = (c[273] | 0) + 1;
 }
 ud(c[367] | 0);
 Cd(c[409] | 0, 0);
 return;
}

function De() {
 var b = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 64 | 0;
 e = h + 48 | 0;
 g = h + 32 | 0;
 f = h + 16 | 0;
 b = h;
 if (c[697] | 0) {
  Qi(14554, c[11] | 0) | 0;
  Qi(14554, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 ed(125, 37, 37);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  cc();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 c[341] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 13, 1) | 0;
 if (c[263] | 0) {
  Db();
  Qi(14602, c[11] | 0) | 0;
  Qi(14602, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[(c[271] | 0) + (c[341] << 2) >> 2] = c[(c[167] | 0) + (c[341] << 2) >> 2];
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 34) {
  g = c[11] | 0;
  e = d[8903] | 0;
  c[b >> 2] = 14633;
  c[b + 4 >> 2] = e;
  c[b + 8 >> 2] = 14661;
  $i(g, 12651, b) | 0;
  g = c[12] | 0;
  e = d[8903] | 0;
  c[f >> 2] = 14633;
  c[f + 4 >> 2] = e;
  c[f + 8 >> 2] = 14661;
  $i(g, 12651, f) | 0;
  Yb();
  i = h;
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(_c(34) | 0)) {
  f = c[11] | 0;
  b = d[8903] | 0;
  c[g >> 2] = 14672;
  c[g + 4 >> 2] = b;
  c[g + 8 >> 2] = 14685;
  $i(f, 12651, g) | 0;
  g = c[12] | 0;
  f = d[8903] | 0;
  c[e >> 2] = 14672;
  c[e + 4 >> 2] = f;
  c[e + 8 >> 2] = 14685;
  $i(g, 12651, e) | 0;
  Yb();
  i = h;
  return;
 }
 c[699] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 0, 1) | 0;
 a[(c[166] | 0) + (c[699] | 0) >> 0] = 3;
 c[(c[271] | 0) + (c[341] << 2) >> 2] = c[(c[167] | 0) + (c[699] << 2) >> 2];
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(14596, c[11] | 0) | 0;
  Qi(14596, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 } else {
  c[67] = (c[67] | 0) + 1;
  i = h;
  return;
 }
}
function Vg(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 t = i;
 i = i + 128 | 0;
 r = t + 8 | 0;
 q = t;
 g = t + 112 | 0;
 h = t + 108 | 0;
 j = t + 104 | 0;
 k = t + 100 | 0;
 p = t + 32 | 0;
 o = t + 28 | 0;
 m = t + 24 | 0;
 l = t + 20 | 0;
 n = t + 16 | 0;
 c[h >> 2] = b;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[o >> 2] = 0;
 f = p;
 e = (c[h >> 2] | 0) + 132 + ((c[j >> 2] | 0) * 68 | 0) | 0;
 b = f + 68 | 0;
 do {
  c[f >> 2] = c[e >> 2];
  f = f + 4 | 0;
  e = e + 4 | 0;
 } while ((f | 0) < (b | 0));
 if (!(c[p >> 2] | 0)) {
  ef(c[h >> 2] | 0, c[j >> 2] | 0) | 0;
  f = p;
  e = (c[h >> 2] | 0) + 132 + ((c[j >> 2] | 0) * 68 | 0) | 0;
  b = f + 68 | 0;
  do {
   c[f >> 2] = c[e >> 2];
   f = f + 4 | 0;
   e = e + 4 | 0;
  } while ((f | 0) < (b | 0));
 }
 if (c[p + 44 >> 2] | 0) if (c[p + 56 >> 2] | 0) {
  c[m >> 2] = kh((c[p + 48 >> 2] | 0) + 2 << 2) | 0;
  if ((a[c[k >> 2] >> 0] | 0) == 45) {
   s = c[1840] | 0;
   r = a[c[k >> 2] >> 0] | 0;
   c[q >> 2] = c[k >> 2];
   c[q + 4 >> 2] = r;
   $i(s, 27889, q) | 0;
   c[g >> 2] = 0;
   s = c[g >> 2] | 0;
   i = t;
   return s | 0;
  }
  c[n >> 2] = 0;
  while (1) {
   if (!(a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0)) break;
   if (hi(a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) | 0) {
    if (!(gi(d[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) | 0)) s = 11;
   } else s = 11;
   if ((s | 0) == 11) {
    s = 0;
    if ((a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) != 45) if ((a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) != 43) if ((a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) != 95) if ((a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) != 46) if ((a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0) != 47) {
     s = 16;
     break;
    }
   }
   c[n >> 2] = (c[n >> 2] | 0) + 1;
  }
  if ((s | 0) == 16) {
   s = c[1840] | 0;
   q = a[(c[k >> 2] | 0) + (c[n >> 2] | 0) >> 0] | 0;
   c[r >> 2] = c[k >> 2];
   c[r + 4 >> 2] = q;
   $i(s, 27949, r) | 0;
   c[g >> 2] = 0;
   s = c[g >> 2] | 0;
   i = t;
   return s | 0;
  }
  if ((c[j >> 2] | 0) == 0 | (c[j >> 2] | 0) == 1 | (c[j >> 2] | 0) == 2) Wg(c[h >> 2] | 0);
  c[l >> 2] = 0;
  while (1) {
   if ((c[l >> 2] | 0) >= (c[p + 48 >> 2] | 0)) break;
   s = bh(c[h >> 2] | 0, c[(c[p + 52 >> 2] | 0) + (c[l >> 2] << 2) >> 2] | 0) | 0;
   c[(c[m >> 2] | 0) + (c[l >> 2] << 2) >> 2] = s;
   c[l >> 2] = (c[l >> 2] | 0) + 1;
  }
  r = nh(c[k >> 2] | 0) | 0;
  s = c[l >> 2] | 0;
  c[l >> 2] = s + 1;
  c[(c[m >> 2] | 0) + (s << 2) >> 2] = r;
  c[(c[m >> 2] | 0) + (c[l >> 2] << 2) >> 2] = 0;
  c[o >> 2] = Xg(c[h >> 2] | 0, c[j >> 2] | 0, c[m >> 2] | 0) | 0;
  c[l >> 2] = 0;
  while (1) {
   if (!(c[(c[m >> 2] | 0) + (c[l >> 2] << 2) >> 2] | 0)) break;
   Cj(c[(c[m >> 2] | 0) + (c[l >> 2] << 2) >> 2] | 0);
   c[l >> 2] = (c[l >> 2] | 0) + 1;
  }
  Cj(c[m >> 2] | 0);
 }
 c[g >> 2] = c[o >> 2];
 s = c[g >> 2] | 0;
 i = t;
 return s | 0;
}

function Qc(b, e, f, g, h) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0;
 w = i;
 i = i + 64 | 0;
 u = w + 8 | 0;
 t = w;
 j = w + 48 | 0;
 k = w + 44 | 0;
 l = w + 40 | 0;
 m = w + 52 | 0;
 n = w + 36 | 0;
 o = w + 32 | 0;
 p = w + 28 | 0;
 r = w + 24 | 0;
 q = w + 20 | 0;
 s = w + 16 | 0;
 c[j >> 2] = b;
 c[k >> 2] = e;
 c[l >> 2] = f;
 a[m >> 0] = g;
 c[n >> 2] = h;
 c[p >> 2] = 0;
 c[q >> 2] = c[k >> 2];
 while (1) {
  b = c[p >> 2] | 0;
  if ((c[q >> 2] | 0) >= ((c[k >> 2] | 0) + (c[l >> 2] | 0) | 0)) break;
  c[p >> 2] = b + (c[p >> 2] | 0) + (d[(c[j >> 2] | 0) + (c[q >> 2] | 0) >> 0] | 0);
  while (1) {
   if ((c[p >> 2] | 0) < (c[262] | 0)) break;
   c[p >> 2] = (c[p >> 2] | 0) - (c[262] | 0);
  }
  c[q >> 2] = (c[q >> 2] | 0) + 1;
 }
 c[r >> 2] = b + 1;
 c[263] = 0;
 c[s >> 2] = 0;
 while (1) {
  if ((c[(c[167] | 0) + (c[r >> 2] << 2) >> 2] | 0) > 0) if (Mc(c[(c[167] | 0) + (c[r >> 2] << 2) >> 2] | 0, c[j >> 2] | 0, c[k >> 2] | 0, c[l >> 2] | 0) | 0) {
   if ((d[(c[264] | 0) + (c[r >> 2] | 0) >> 0] | 0 | 0) == (d[m >> 0] | 0 | 0)) {
    v = 11;
    break;
   }
   c[s >> 2] = c[(c[167] | 0) + (c[r >> 2] << 2) >> 2];
  }
  if (!(c[(c[265] | 0) + (c[r >> 2] << 2) >> 2] | 0)) break;
  c[r >> 2] = c[(c[265] | 0) + (c[r >> 2] << 2) >> 2];
 }
 if ((v | 0) == 11) {
  c[263] = 1;
  v = c[r >> 2] | 0;
  c[o >> 2] = v;
  v = c[o >> 2] | 0;
  i = w;
  return v | 0;
 }
 if (!(c[n >> 2] | 0)) {
  v = c[r >> 2] | 0;
  c[o >> 2] = v;
  v = c[o >> 2] | 0;
  i = w;
  return v | 0;
 }
 do if ((c[(c[167] | 0) + (c[r >> 2] << 2) >> 2] | 0) > 0) {
  while (1) {
   if ((c[266] | 0) == 1) {
    v = 17;
    break;
   }
   c[266] = (c[266] | 0) - 1;
   if (!((c[(c[167] | 0) + (c[266] << 2) >> 2] | 0) == 0 ^ 1)) {
    v = 19;
    break;
   }
  }
  if ((v | 0) == 17) {
   vb();
   v = c[11] | 0;
   p = c[267] | 0;
   c[t >> 2] = 11400;
   c[t + 4 >> 2] = p;
   $i(v, 11369, t) | 0;
   v = c[12] | 0;
   t = c[267] | 0;
   c[u >> 2] = 11400;
   c[u + 4 >> 2] = t;
   $i(v, 11369, u) | 0;
   xa(96, 1);
  } else if ((v | 0) == 19) {
   c[(c[265] | 0) + (c[r >> 2] << 2) >> 2] = c[266];
   c[r >> 2] = c[266];
   break;
  }
 } while (0);
 if ((c[s >> 2] | 0) > 0) c[(c[167] | 0) + (c[r >> 2] << 2) >> 2] = c[s >> 2]; else {
  while (1) {
   if (((c[259] | 0) + (c[l >> 2] | 0) | 0) <= (c[65] | 0)) break;
   Bb();
  }
  c[q >> 2] = c[k >> 2];
  while (1) {
   if ((c[q >> 2] | 0) >= ((c[k >> 2] | 0) + (c[l >> 2] | 0) | 0)) break;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[j >> 2] | 0) + (c[q >> 2] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[q >> 2] = (c[q >> 2] | 0) + 1;
  }
  v = Lc() | 0;
  c[(c[167] | 0) + (c[r >> 2] << 2) >> 2] = v;
 }
 a[(c[264] | 0) + (c[r >> 2] | 0) >> 0] = a[m >> 0] | 0;
 v = c[r >> 2] | 0;
 c[o >> 2] = v;
 v = c[o >> 2] | 0;
 i = w;
 return v | 0;
}

function vf(b, d, e, f, g, h) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0;
 x = i;
 i = i + 80 | 0;
 v = x;
 j = x + 64 | 0;
 k = x + 60 | 0;
 l = x + 56 | 0;
 m = x + 52 | 0;
 n = x + 48 | 0;
 o = x + 44 | 0;
 p = x + 40 | 0;
 r = x + 36 | 0;
 s = x + 32 | 0;
 t = x + 28 | 0;
 u = x + 24 | 0;
 q = x + 20 | 0;
 c[k >> 2] = b;
 c[l >> 2] = d;
 c[m >> 2] = e;
 c[n >> 2] = f;
 c[o >> 2] = g;
 c[p >> 2] = h;
 c[r >> 2] = $g(c[k >> 2] | 0, c[m >> 2] | 0) | 0;
 if (!(c[r >> 2] | 0)) c[r >> 2] = c[n >> 2];
 if ((a[c[r >> 2] >> 0] | 0) != 97) if ((a[c[r >> 2] >> 0] | 0) != 121) if ((a[c[r >> 2] >> 0] | 0) != 49) {
  c[t >> 2] = c[l >> 2];
  a : while (1) {
   h = ui(c[t >> 2] | 0, 46) | 0;
   c[s >> 2] = h;
   if (!h) {
    w = 17;
    break;
   }
   if ((c[s >> 2] | 0) == (c[l >> 2] | 0)) w = 11; else if ((a[(c[s >> 2] | 0) + -1 >> 0] | 0) == 47) w = 11;
   do if ((w | 0) == 11) {
    w = 0;
    if ((a[(c[s >> 2] | 0) + 1 >> 0] | 0) != 47) {
     if ((a[(c[s >> 2] | 0) + 1 >> 0] | 0) == 46) if ((a[(c[s >> 2] | 0) + 2 >> 0] | 0) == 47) break;
     if (!(c[s >> 2] | 0)) break a;
     if (Ci(c[s >> 2] | 0, 18021) | 0) break a;
    }
   } while (0);
   c[t >> 2] = (c[s >> 2] | 0) + 1;
  }
  b : do if ((w | 0) == 17) {
   if ((a[c[r >> 2] >> 0] | 0) != 114) if ((a[c[r >> 2] >> 0] | 0) != 110) if ((a[c[r >> 2] >> 0] | 0) != 48) {
    if (yf(c[k >> 2] | 0, c[l >> 2] | 0, 0) | 0) {
     c[u >> 2] = $g(c[k >> 2] | 0, 28238) | 0;
     if (!(c[u >> 2] | 0)) break;
     if (!(a[c[u >> 2] >> 0] | 0)) break;
     w = c[l >> 2] | 0;
     if ((w | 0) != (Bi(c[l >> 2] | 0, c[u >> 2] | 0) | 0)) break;
     w = si(c[u >> 2] | 0) | 0;
     if ((a[(c[l >> 2] | 0) + w >> 0] | 0) != 47) break;
    }
    if ((a[c[l >> 2] >> 0] | 0) == 46) if ((a[(c[l >> 2] | 0) + 1 >> 0] | 0) == 46) if ((a[(c[l >> 2] | 0) + 2 >> 0] | 0) == 47) break;
    c[q >> 2] = Bi(c[l >> 2] | 0, 21586) | 0;
    while (1) {
     if (!(c[q >> 2] | 0)) break;
     if ((a[(c[q >> 2] | 0) + 2 >> 0] | 0) == 47) if ((a[(c[q >> 2] | 0) + -1 >> 0] | 0) == 47) break b;
     c[q >> 2] = Bi((c[q >> 2] | 0) + 2 | 0, 21586) | 0;
    }
    c[j >> 2] = 1;
    w = c[j >> 2] | 0;
    i = x;
    return w | 0;
   }
   c[j >> 2] = 1;
   w = c[j >> 2] | 0;
   i = x;
   return w | 0;
  } while (0);
  if (!(c[p >> 2] | 0)) {
   w = c[1840] | 0;
   s = c[2924 + (c[o >> 2] << 2) >> 2] | 0;
   t = c[l >> 2] | 0;
   h = c[m >> 2] | 0;
   u = c[r >> 2] | 0;
   c[v >> 2] = c[(c[k >> 2] | 0) + 104 >> 2];
   c[v + 4 >> 2] = s;
   c[v + 8 >> 2] = t;
   c[v + 12 >> 2] = h;
   c[v + 16 >> 2] = u;
   $i(w, 19821, v) | 0;
  }
  c[j >> 2] = 0;
  w = c[j >> 2] | 0;
  i = x;
  return w | 0;
 }
 c[j >> 2] = 1;
 w = c[j >> 2] | 0;
 i = x;
 return w | 0;
}

function wd() {
 var a = 0, b = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 a = e;
 c[356] = 0;
 c[a >> 2] = 0;
 a : while (1) {
  if ((c[357] | 0) >= (c[358] | 0)) {
   b = 38;
   break;
  }
  if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) >= 65) if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) <= 90) {
   b = 38;
   break;
  }
  if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) >= 97) if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) <= 122) {
   b = 7;
   break;
  }
  if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) != 123) {
   c[357] = (c[357] | 0) + 1;
   continue;
  }
  c[356] = (c[356] | 0) + 1;
  c[357] = (c[357] | 0) + 1;
  if (((c[357] | 0) + 2 | 0) < (c[358] | 0)) if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 92) {
   b = 11;
   break;
  }
  while (1) {
   if ((c[356] | 0) <= 0) continue a;
   if ((c[357] | 0) >= (c[358] | 0)) continue a;
   if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 125) c[356] = (c[356] | 0) - 1; else if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 123) c[356] = (c[356] | 0) + 1;
   c[357] = (c[357] | 0) + 1;
  }
 }
 if ((b | 0) == 7) {
  c[a >> 2] = 1;
  b = c[a >> 2] | 0;
  i = e;
  return b | 0;
 } else if ((b | 0) == 11) {
  c[357] = (c[357] | 0) + 1;
  c[359] = c[357];
  while (1) {
   if ((c[357] | 0) >= (c[358] | 0)) break;
   if ((d[8613 + (d[(c[16] | 0) + (c[357] | 0) >> 0] | 0) >> 0] | 0 | 0) != 2) break;
   c[357] = (c[357] | 0) + 1;
  }
  c[360] = Qc(c[16] | 0, c[359] | 0, (c[357] | 0) - (c[359] | 0) | 0, 14, 0) | 0;
  if (c[263] | 0) switch (c[(c[271] | 0) + (c[360] << 2) >> 2] | 0) {
  case 12:
  case 10:
  case 8:
  case 6:
  case 4:
  case 2:
  case 1:
  case 0:
   {
    c[a >> 2] = 1;
    b = c[a >> 2] | 0;
    i = e;
    return b | 0;
   }
  case 11:
  case 9:
  case 7:
  case 5:
  case 3:
   {
    b = c[a >> 2] | 0;
    i = e;
    return b | 0;
   }
  default:
   {
    Qi(12884, c[11] | 0) | 0;
    Qi(12884, c[12] | 0) | 0;
    wb();
    xa(96, 1);
   }
  }
  while (1) {
   if (!((c[357] | 0) < (c[358] | 0) ? (c[356] | 0) > 0 : 0)) {
    b = 38;
    break;
   }
   if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) >= 65) if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) <= 90) {
    b = 38;
    break;
   }
   if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) >= 97) if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) <= 122) {
    b = 24;
    break;
   }
   if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 125) c[356] = (c[356] | 0) - 1; else if ((d[(c[16] | 0) + (c[357] | 0) >> 0] | 0 | 0) == 123) c[356] = (c[356] | 0) + 1;
   c[357] = (c[357] | 0) + 1;
  }
  if ((b | 0) == 24) {
   c[a >> 2] = 1;
   b = c[a >> 2] | 0;
   i = e;
   return b | 0;
  } else if ((b | 0) == 38) {
   b = c[a >> 2] | 0;
   i = e;
   return b | 0;
  }
 } else if ((b | 0) == 38) {
  b = c[a >> 2] | 0;
  i = e;
  return b | 0;
 }
 return 0;
}

function Xc(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 48 | 0;
 h = n + 32 | 0;
 j = n + 28 | 0;
 k = n + 24 | 0;
 m = n + 20 | 0;
 f = n + 16 | 0;
 g = n + 12 | 0;
 l = n + 8 | 0;
 d = n + 4 | 0;
 e = n;
 c[h >> 2] = a;
 c[j >> 2] = b;
 a = c[h >> 2] | 0;
 if (((c[j >> 2] | 0) - (c[h >> 2] | 0) | 0) < 10) {
  c[f >> 2] = a + 1;
  c[d >> 2] = c[j >> 2];
  if ((c[f >> 2] | 0) > (c[d >> 2] | 0)) {
   i = n;
   return;
  }
  do {
   c[m >> 2] = c[f >> 2];
   c[e >> 2] = (c[h >> 2] | 0) + 1;
   a : do if ((c[m >> 2] | 0) >= (c[e >> 2] | 0)) do {
    if (Wc(c[(c[124] | 0) + ((c[m >> 2] | 0) - 1 << 2) >> 2] | 0, c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0) | 0) break a;
    Vc((c[m >> 2] | 0) - 1 | 0, c[m >> 2] | 0);
    l = c[m >> 2] | 0;
    c[m >> 2] = l + -1;
   } while ((l | 0) > (c[e >> 2] | 0)); while (0);
   l = c[f >> 2] | 0;
   c[f >> 2] = l + 1;
  } while ((l | 0) < (c[d >> 2] | 0));
  i = n;
  return;
 }
 c[k >> 2] = a + 4;
 c[g >> 2] = ((c[h >> 2] | 0) + (c[j >> 2] | 0) | 0) / 2 | 0;
 c[m >> 2] = (c[j >> 2] | 0) - 4;
 do if (Wc(c[(c[124] | 0) + (c[k >> 2] << 2) >> 2] | 0, c[(c[124] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0) {
  if (Wc(c[(c[124] | 0) + (c[g >> 2] << 2) >> 2] | 0, c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0) | 0) {
   Vc(c[h >> 2] | 0, c[g >> 2] | 0);
   break;
  }
  g = (Wc(c[(c[124] | 0) + (c[k >> 2] << 2) >> 2] | 0, c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0) | 0) != 0;
  a = c[h >> 2] | 0;
  if (g) {
   Vc(a, c[m >> 2] | 0);
   break;
  } else {
   Vc(a, c[k >> 2] | 0);
   break;
  }
 } else {
  if (Wc(c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0, c[(c[124] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0) {
   Vc(c[h >> 2] | 0, c[g >> 2] | 0);
   break;
  }
  g = (Wc(c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0, c[(c[124] | 0) + (c[k >> 2] << 2) >> 2] | 0) | 0) != 0;
  a = c[h >> 2] | 0;
  if (g) {
   Vc(a, c[m >> 2] | 0);
   break;
  } else {
   Vc(a, c[k >> 2] | 0);
   break;
  }
 } while (0);
 c[l >> 2] = c[(c[124] | 0) + (c[h >> 2] << 2) >> 2];
 c[k >> 2] = (c[h >> 2] | 0) + 1;
 c[m >> 2] = c[j >> 2];
 while (1) {
  if (Wc(c[(c[124] | 0) + (c[k >> 2] << 2) >> 2] | 0, c[l >> 2] | 0) | 0) {
   c[k >> 2] = (c[k >> 2] | 0) + 1;
   continue;
  }
  while (1) {
   if (!(Wc(c[l >> 2] | 0, c[(c[124] | 0) + (c[m >> 2] << 2) >> 2] | 0) | 0)) break;
   c[m >> 2] = (c[m >> 2] | 0) - 1;
  }
  if ((c[k >> 2] | 0) < (c[m >> 2] | 0)) {
   Vc(c[k >> 2] | 0, c[m >> 2] | 0);
   c[k >> 2] = (c[k >> 2] | 0) + 1;
   c[m >> 2] = (c[m >> 2] | 0) - 1;
  }
  if (!((c[k >> 2] | 0) == ((c[m >> 2] | 0) + 1 | 0) ^ 1)) break;
 }
 Vc(c[h >> 2] | 0, c[m >> 2] | 0);
 Xc(c[h >> 2] | 0, (c[m >> 2] | 0) - 1 | 0);
 Xc(c[k >> 2] | 0, c[j >> 2] | 0);
 i = n;
 return;
}

function de() {
 var b = 0;
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 c[355] = 0;
 Kd(c[367] | 0);
 c[352] = 0;
 c[345] = 0;
 c[273] = 0;
 while (1) {
  if ((c[273] | 0) >= (c[355] | 0)) break;
  a : do switch (d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) {
  case 4:
  case 1:
   {
    a[(c[17] | 0) + (c[345] | 0) >> 0] = 32;
    c[345] = (c[345] | 0) + 1;
    break;
   }
  case 3:
  case 2:
   {
    a[(c[17] | 0) + (c[345] | 0) >> 0] = a[(c[17] | 0) + (c[273] | 0) >> 0] | 0;
    c[345] = (c[345] | 0) + 1;
    break;
   }
  default:
   {
    if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) != 123) {
     if (!((c[352] | 0) > 0 ? (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125 : 0)) break a;
     c[352] = (c[352] | 0) - 1;
     break a;
    }
    c[352] = (c[352] | 0) + 1;
    if ((c[352] | 0) == 1) if (((c[273] | 0) + 1 | 0) < (c[355] | 0)) if ((d[(c[17] | 0) + ((c[273] | 0) + 1) >> 0] | 0 | 0) == 92) {
     c[273] = (c[273] | 0) + 1;
     b : while (1) {
      b = c[273] | 0;
      if (!((c[273] | 0) < (c[355] | 0) ? (c[352] | 0) > 0 : 0)) break;
      c[273] = b + 1;
      c[369] = c[273];
      while (1) {
       if ((c[273] | 0) >= (c[355] | 0)) break;
       if ((d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) != 2) break;
       c[273] = (c[273] | 0) + 1;
      }
      c[360] = Qc(c[17] | 0, c[369] | 0, (c[273] | 0) - (c[369] | 0) | 0, 14, 0) | 0;
      c : do if (c[263] | 0) {
       a[(c[17] | 0) + (c[345] | 0) >> 0] = a[(c[17] | 0) + (c[369] | 0) >> 0] | 0;
       c[345] = (c[345] | 0) + 1;
       switch (c[(c[271] | 0) + (c[360] << 2) >> 2] | 0) {
       case 12:
       case 5:
       case 4:
       case 3:
       case 2:
        break;
       default:
        break c;
       }
       a[(c[17] | 0) + (c[345] | 0) >> 0] = a[(c[17] | 0) + ((c[369] | 0) + 1) >> 0] | 0;
       c[345] = (c[345] | 0) + 1;
      } while (0);
      while (1) {
       if (!((c[352] | 0) > 0 ? (c[273] | 0) < (c[355] | 0) : 0)) continue b;
       if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 92) continue b;
       b = a[(c[17] | 0) + (c[273] | 0) >> 0] | 0;
       do if (((d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0) + -2 | 0) >>> 0 < 2) {
        a[(c[17] | 0) + (c[345] | 0) >> 0] = b;
        c[345] = (c[345] | 0) + 1;
       } else {
        if ((b & 255 | 0) == 125) {
         c[352] = (c[352] | 0) - 1;
         break;
        }
        if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 123) c[352] = (c[352] | 0) + 1;
       } while (0);
       c[273] = (c[273] | 0) + 1;
      }
     }
     c[273] = b - 1;
    }
   }
  } while (0);
  c[273] = (c[273] | 0) + 1;
 }
 c[355] = c[345];
 Jd();
 return;
}

function Ue(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 32 | 0;
 g = m + 20 | 0;
 h = m + 16 | 0;
 j = m + 12 | 0;
 k = m + 8 | 0;
 f = m + 4 | 0;
 l = m;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[k >> 2] = 0;
 c[c[g >> 2] >> 2] = 0;
 if (c[723] | 0) Cj(c[723] | 0);
 c[723] = 0;
 do if (c[722] | 0) if (!(zf((c[70] | 0) + 1 | 0, 0) | 0)) {
  c[k >> 2] = Ef(c[722] | 0, 29173, (c[70] | 0) + 1 | 0) | 0;
  e = ej(c[k >> 2] | 0, c[j >> 2] | 0) | 0;
  c[c[g >> 2] >> 2] = e;
  if (c[c[g >> 2] >> 2] | 0) {
   Cj(c[70] | 0);
   c[71] = si(c[k >> 2] | 0) | 0;
   c[70] = kh((c[71] | 0) + 2 | 0) | 0;
   zi((c[70] | 0) + 1 | 0, c[k >> 2] | 0) | 0;
   c[723] = c[k >> 2];
   break;
  } else {
   Cj(c[k >> 2] | 0);
   break;
  }
 } while (0);
 do if (!(c[c[g >> 2] >> 2] | 0)) {
  if ((c[h >> 2] | 0) < 0) {
   l = ej((c[70] | 0) + 1 | 0, c[j >> 2] | 0) | 0;
   c[c[g >> 2] >> 2] = l;
   break;
  }
  if ((c[h >> 2] | 0) != 26 | (c[724] | 0) != 0) b = (c[h >> 2] | 0) != 33; else b = 0;
  c[f >> 2] = b & 1;
  c[k >> 2] = jf((c[70] | 0) + 1 | 0, c[h >> 2] | 0, c[f >> 2] | 0) | 0;
  if (c[k >> 2] | 0) {
   c[723] = nh(c[k >> 2] | 0) | 0;
   do if ((a[c[k >> 2] >> 0] | 0) == 46) if ((a[(c[k >> 2] | 0) + 1 >> 0] | 0) == 47) {
    if ((a[(c[70] | 0) + 1 >> 0] | 0) == 46) if ((a[(c[70] | 0) + 2 >> 0] | 0) == 47) break;
    c[l >> 2] = 0;
    while (1) {
     b = c[l >> 2] | 0;
     if (!(a[(c[k >> 2] | 0) + ((c[l >> 2] | 0) + 2) >> 0] | 0)) break;
     a[(c[k >> 2] | 0) + (c[l >> 2] | 0) >> 0] = a[(c[k >> 2] | 0) + (b + 2) >> 0] | 0;
     c[l >> 2] = (c[l >> 2] | 0) + 1;
    }
    a[(c[k >> 2] | 0) + b >> 0] = 0;
   } while (0);
   Cj(c[70] | 0);
   c[71] = si(c[k >> 2] | 0) | 0;
   c[70] = kh((c[71] | 0) + 2 | 0) | 0;
   zi((c[70] | 0) + 1 | 0, c[k >> 2] | 0) | 0;
   Cj(c[k >> 2] | 0);
   l = hh((c[70] | 0) + 1 | 0, c[j >> 2] | 0) | 0;
   c[c[g >> 2] >> 2] = l;
  }
 } while (0);
 if (!(c[c[g >> 2] >> 2] | 0)) {
  l = c[g >> 2] | 0;
  l = c[l >> 2] | 0;
  l = (l | 0) != 0;
  l = l & 1;
  i = m;
  return l | 0;
 }
 Se((c[70] | 0) + 1 | 0);
 if ((c[h >> 2] | 0) == 3) {
  c[725] = Oi(c[c[g >> 2] >> 2] | 0) | 0;
  l = c[g >> 2] | 0;
  l = c[l >> 2] | 0;
  l = (l | 0) != 0;
  l = l & 1;
  i = m;
  return l | 0;
 }
 if ((c[h >> 2] | 0) == 19) {
  c[726] = Oi(c[c[g >> 2] >> 2] | 0) | 0;
  l = c[g >> 2] | 0;
  l = c[l >> 2] | 0;
  l = (l | 0) != 0;
  l = l & 1;
  i = m;
  return l | 0;
 }
 if ((c[h >> 2] | 0) != 20) {
  l = c[g >> 2] | 0;
  l = c[l >> 2] | 0;
  l = (l | 0) != 0;
  l = l & 1;
  i = m;
  return l | 0;
 }
 c[725] = Oi(c[c[g >> 2] >> 2] | 0) | 0;
 l = c[g >> 2] | 0;
 l = c[l >> 2] | 0;
 l = (l | 0) != 0;
 l = l & 1;
 i = m;
 return l | 0;
}

function Hf(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 r = i;
 i = i + 80 | 0;
 p = r + 8 | 0;
 o = r;
 b = r + 76 | 0;
 g = r + 72 | 0;
 f = r + 68 | 0;
 k = r + 64 | 0;
 n = r + 56 | 0;
 h = r + 52 | 0;
 j = r + 48 | 0;
 s = r + 40 | 0;
 l = r + 36 | 0;
 m = r + 32 | 0;
 d = r + 24 | 0;
 e = r + 16 | 0;
 c[b >> 2] = a;
 c[j >> 2] = 0;
 c[g >> 2] = ef(c[b >> 2] | 0, 9) | 0;
 c[f >> 2] = pg(c[b >> 2] | 0, c[g >> 2] | 0, 2932, 1, 1) | 0;
 c[k >> 2] = c[f >> 2];
 c[h >> 2] = 0;
 Kf(s);
 c[n >> 2] = c[s >> 2];
 c[n + 4 >> 2] = c[s + 4 >> 2];
 while (1) {
  if (!(c[(c[f >> 2] | 0) + (c[h >> 2] << 2) >> 2] | 0)) break;
  c[l >> 2] = c[(c[f >> 2] | 0) + (c[h >> 2] << 2) >> 2];
  c[m >> 2] = c[(c[f >> 2] | 0) + ((c[h >> 2] | 0) + 1 << 2) >> 2];
  if (c[m >> 2] | 0) if (!(xi(c[l >> 2] | 0, c[m >> 2] | 0) | 0)) if (Zf(c[l >> 2] | 0, c[m >> 2] | 0) | 0) {
   if (c[(c[b >> 2] | 0) + 44 >> 2] & 2) {
    Qi(29466, c[1840] | 0) | 0;
    s = c[1840] | 0;
    a = c[m >> 2] | 0;
    c[o >> 2] = c[l >> 2];
    c[o + 4 >> 2] = a;
    $i(s, 20184, o) | 0;
    ij(c[1840] | 0) | 0;
   }
   Cj(c[l >> 2] | 0);
  } else q = 9; else q = 9; else q = 9;
  if ((q | 0) == 9) {
   q = 0;
   if (c[(c[b >> 2] | 0) + 44 >> 2] & 2) {
    Qi(29466, c[1840] | 0) | 0;
    s = c[1840] | 0;
    c[p >> 2] = c[l >> 2];
    $i(s, 20237, p) | 0;
    ij(c[1840] | 0) | 0;
   }
   Lg(n, c[l >> 2] | 0);
  }
  c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 Lg(n, 0);
 Cj(c[k >> 2] | 0);
 c[f >> 2] = c[n + 4 >> 2];
 c[k >> 2] = c[f >> 2];
 s = (c[b >> 2] | 0) + 20 | 0;
 cg(d, 64007);
 c[s >> 2] = c[d >> 2];
 c[s + 4 >> 2] = c[d + 4 >> 2];
 while (1) {
  if (!(c[f >> 2] | 0)) break;
  if (!(c[c[f >> 2] >> 2] | 0)) break;
  if (Lf(c[b >> 2] | 0, (c[b >> 2] | 0) + 20 | 0, c[c[f >> 2] >> 2] | 0) | 0) c[j >> 2] = 1;
  Cj(c[c[f >> 2] >> 2] | 0);
  c[f >> 2] = (c[f >> 2] | 0) + 4;
 }
 if (!(c[j >> 2] | 0)) {
  Cj(c[(c[b >> 2] | 0) + 20 >> 2] | 0);
  c[(c[b >> 2] | 0) + 20 >> 2] = 0;
 }
 Cj(c[k >> 2] | 0);
 c[j >> 2] = 0;
 c[f >> 2] = rg(c[b >> 2] | 0, c[g >> 2] | 0, 20267) | 0;
 c[k >> 2] = c[f >> 2];
 s = (c[b >> 2] | 0) + 28 | 0;
 cg(e, 1009);
 c[s >> 2] = c[e >> 2];
 c[s + 4 >> 2] = c[e + 4 >> 2];
 while (1) {
  if (!(c[f >> 2] | 0)) break;
  if (!(c[c[f >> 2] >> 2] | 0)) break;
  if (Mf(c[b >> 2] | 0, (c[b >> 2] | 0) + 28 | 0, c[c[f >> 2] >> 2] | 0) | 0) c[j >> 2] = 1;
  Cj(c[c[f >> 2] >> 2] | 0);
  c[f >> 2] = (c[f >> 2] | 0) + 4;
 }
 if (c[j >> 2] | 0) {
  s = c[k >> 2] | 0;
  Cj(s);
  i = r;
  return;
 }
 Cj(c[(c[b >> 2] | 0) + 28 >> 2] | 0);
 c[(c[b >> 2] | 0) + 28 >> 2] = 0;
 s = c[k >> 2] | 0;
 Cj(s);
 i = r;
 return;
}

function Ag(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 t = i;
 i = i + 64 | 0;
 s = t + 16 | 0;
 r = t + 8 | 0;
 q = t;
 f = t + 52 | 0;
 g = t + 48 | 0;
 h = t + 44 | 0;
 k = t + 40 | 0;
 m = t + 36 | 0;
 p = t + 32 | 0;
 n = t + 28 | 0;
 o = t + 24 | 0;
 l = t + 20 | 0;
 j = t + 56 | 0;
 c[f >> 2] = b;
 c[g >> 2] = d;
 c[h >> 2] = e;
 c[l >> 2] = Ka(21244) | 0;
 if (c[l >> 2] | 0) {
  e = oi(c[l >> 2] | 0) | 0;
  l = (c[f >> 2] | 0) + 44 | 0;
  c[l >> 2] = c[l >> 2] | e;
 }
 l = nh(c[g >> 2] | 0) | 0;
 c[(c[f >> 2] | 0) + 104 >> 2] = l;
 c[m >> 2] = zg(c[f >> 2] | 0, c[(c[f >> 2] | 0) + 104 >> 2] | 0) | 0;
 l = c[f >> 2] | 0;
 lh(l, 21259, Eg(c[m >> 2] | 0) | 0);
 c[p >> 2] = gh(c[m >> 2] | 0) | 0;
 l = c[f >> 2] | 0;
 lh(l, 21271, Eg(c[p >> 2] | 0) | 0);
 c[n >> 2] = gh(c[p >> 2] | 0) | 0;
 l = c[f >> 2] | 0;
 lh(l, 21283, Eg(c[n >> 2] | 0) | 0);
 c[o >> 2] = gh(c[n >> 2] | 0) | 0;
 l = c[f >> 2] | 0;
 lh(l, 21298, Eg(c[o >> 2] | 0) | 0);
 Cj(c[m >> 2] | 0);
 Cj(c[p >> 2] | 0);
 Cj(c[n >> 2] | 0);
 Cj(c[o >> 2] | 0);
 p = nh(fh(c[(c[f >> 2] | 0) + 104 >> 2] | 0) | 0) | 0;
 c[(c[f >> 2] | 0) + 108 >> 2] = p;
 do if (c[h >> 2] | 0) {
  p = nh(c[h >> 2] | 0) | 0;
  c[(c[f >> 2] | 0) + 112 >> 2] = p;
 } else {
  c[k >> 2] = xh(c[(c[f >> 2] | 0) + 108 >> 2] | 0) | 0;
  if ((c[k >> 2] | 0) != 0 & (c[k >> 2] | 0) != 0) if (!(Ci(c[k >> 2] | 0, 21318) | 0)) {
   p = Kg(c[(c[f >> 2] | 0) + 108 >> 2] | 0) | 0;
   c[(c[f >> 2] | 0) + 112 >> 2] = p;
   break;
  }
  p = nh(c[(c[f >> 2] | 0) + 108 >> 2] | 0) | 0;
  c[(c[f >> 2] | 0) + 112 >> 2] = p;
 } while (0);
 a[j >> 0] = a[21322] | 0;
 a[j + 1 >> 0] = a[21323] | 0;
 a[j + 2 >> 0] = a[21324] | 0;
 a[j + 3 >> 0] = a[21325] | 0;
 if ((qj(j, 2, 21326, q) | 0) != 1) za(21328, 21374, 708, 21432);
 if (a[j + 1 >> 0] | 0) za(21328, 21374, 708, 21432);
 if ((qj(j, 2, 28235, r) | 0) >>> 0 < 2) za(21458, 21374, 709, 21432);
 if (a[j + 1 >> 0] | 0) za(21458, 21374, 709, 21432);
 if ((qj(j, 2, 21515, s) | 0) >>> 0 < 2) za(21519, 21374, 710, 21432);
 if (a[j + 1 >> 0] | 0) za(21519, 21374, 710, 21432);
 if ((c[f >> 2] | 0) == (c[736] | 0)) {
  r = c[f >> 2] | 0;
  s = c[f >> 2] | 0;
  s = s + 112 | 0;
  s = c[s >> 2] | 0;
  lh(r, 21577, s);
  i = t;
  return;
 }
 r = nh(c[(c[f >> 2] | 0) + 104 >> 2] | 0) | 0;
 c[(c[736] | 0) + 104 >> 2] = r;
 r = nh(c[(c[f >> 2] | 0) + 108 >> 2] | 0) | 0;
 c[(c[736] | 0) + 108 >> 2] = r;
 r = c[f >> 2] | 0;
 s = c[f >> 2] | 0;
 s = s + 112 | 0;
 s = c[s >> 2] | 0;
 lh(r, 21577, s);
 i = t;
 return;
}

function ag(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0;
 t = i;
 i = i + 80 | 0;
 s = t + 24 | 0;
 r = t + 8 | 0;
 q = t;
 f = t + 72 | 0;
 g = t + 68 | 0;
 p = t + 64 | 0;
 o = t + 60 | 0;
 k = t + 56 | 0;
 l = t + 52 | 0;
 n = t + 48 | 0;
 j = t + 44 | 0;
 h = t + 40 | 0;
 m = t + 36 | 0;
 c[f >> 2] = b;
 c[g >> 2] = e;
 c[o >> 2] = 0;
 c[k >> 2] = hh(c[g >> 2] | 0, 20591) | 0;
 if (c[c[f >> 2] >> 2] | 0) eb[c[c[f >> 2] >> 2] & 7](c[g >> 2] | 0);
 while (1) {
  e = lg(c[k >> 2] | 0) | 0;
  c[p >> 2] = e;
  if (!e) break;
  c[n >> 2] = c[p >> 2];
  c[j >> 2] = ri(c[n >> 2] | 0, 37) | 0;
  if (!(c[j >> 2] | 0)) c[j >> 2] = Bi(c[n >> 2] | 0, 20593) | 0;
  if (c[j >> 2] | 0) a[c[j >> 2] >> 0] = 0;
  c[o >> 2] = (c[o >> 2] | 0) + 1;
  while (1) {
   if (a[c[n >> 2] >> 0] | 0) if (hi(a[c[n >> 2] >> 0] | 0) | 0) b = (ni(d[c[n >> 2] >> 0] | 0) | 0) != 0; else b = 0; else b = 0;
   e = c[n >> 2] | 0;
   if (!b) break;
   c[n >> 2] = e + 1;
  }
  c[l >> 2] = bg(e) | 0;
  do if (c[l >> 2] | 0) {
   e = c[n >> 2] | 0;
   c[h >> 2] = bg(e + (si(c[l >> 2] | 0) | 0) | 0) | 0;
   if (c[l >> 2] | 0) if (!(Ci(c[l >> 2] | 0, 20596) | 0)) {
    if (!(c[h >> 2] | 0)) {
     Qi(28730, c[1840] | 0) | 0;
     e = c[1840] | 0;
     b = c[o >> 2] | 0;
     c[q >> 2] = c[g >> 2];
     c[q + 4 >> 2] = b;
     $i(e, 20604, q) | 0;
     Qi(29463, c[1840] | 0) | 0;
     ij(c[1840] | 0) | 0;
     break;
    }
    c[m >> 2] = qg(c[f >> 2] | 0, c[(c[f >> 2] | 0) + 72 >> 2] | 0, c[h >> 2] | 0, 0) | 0;
    if (c[m >> 2] | 0) {
     ag(c[f >> 2] | 0, c[m >> 2] | 0);
     if ((c[m >> 2] | 0) != (c[h >> 2] | 0)) Cj(c[m >> 2] | 0);
    } else {
     Qi(28730, c[1840] | 0) | 0;
     e = c[1840] | 0;
     u = c[o >> 2] | 0;
     b = c[h >> 2] | 0;
     c[r >> 2] = c[g >> 2];
     c[r + 4 >> 2] = u;
     c[r + 8 >> 2] = b;
     $i(e, 20669, r) | 0;
     Qi(29463, c[1840] | 0) | 0;
     ij(c[1840] | 0) | 0;
    }
    Cj(c[h >> 2] | 0);
    Cj(c[l >> 2] | 0);
    break;
   }
   if (!(c[h >> 2] | 0)) {
    Qi(28730, c[1840] | 0) | 0;
    u = c[1840] | 0;
    b = c[o >> 2] | 0;
    e = c[l >> 2] | 0;
    c[s >> 2] = c[g >> 2];
    c[s + 4 >> 2] = b;
    c[s + 8 >> 2] = e;
    $i(u, 20724, s) | 0;
    Qi(29463, c[1840] | 0) | 0;
    ij(c[1840] | 0) | 0;
    Cj(c[l >> 2] | 0);
    break;
   } else {
    eg((c[f >> 2] | 0) + 64 | 0, c[h >> 2] | 0, c[l >> 2] | 0);
    break;
   }
  } while (0);
  Cj(c[p >> 2] | 0);
 }
 ih(c[k >> 2] | 0, c[g >> 2] | 0);
 i = t;
 return;
}

function Wg(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 s = i;
 i = i + 192 | 0;
 j = s + 72 | 0;
 h = s + 56 | 0;
 q = s + 40 | 0;
 r = s + 16 | 0;
 g = s;
 m = s + 116 | 0;
 o = s + 120 | 0;
 e = s + 112 | 0;
 b = s + 108 | 0;
 d = s + 104 | 0;
 k = s + 100 | 0;
 l = s + 96 | 0;
 n = s + 92 | 0;
 p = s + 88 | 0;
 f = s + 84 | 0;
 c[m >> 2] = a;
 c[b >> 2] = Ka(28301) | 0;
 c[d >> 2] = Ka(28314) | 0;
 if (c[b >> 2] | 0) b = oi(c[b >> 2] | 0) | 0; else b = 0;
 c[k >> 2] = b;
 if (c[d >> 2] | 0) b = oi(c[d >> 2] | 0) | 0; else b = 0;
 c[l >> 2] = b;
 if (!((c[k >> 2] | 0) != 0 & (c[l >> 2] | 0) != 0)) za(28331, 28353, 49, 28411);
 Gh(c[m >> 2] | 0, c[k >> 2] | 0, c[l >> 2] | 0, e) | 0;
 if (c[e >> 2] | 0) {
  c[f >> 2] = 28601;
  if ((c[e >> 2] | 0) < 0) {
   c[e >> 2] = _(c[e >> 2] | 0, -1) | 0;
   c[f >> 2] = 28483;
  }
  q = (c[e >> 2] | 0) / 2 | 0;
  r = (c[e >> 2] & 1) * 5 | 0;
  c[j >> 2] = c[f >> 2];
  c[j + 4 >> 2] = q;
  c[j + 8 >> 2] = r;
  Xi(o, 28485, j) | 0;
  r = c[m >> 2] | 0;
  lh(r, 28504, o);
  i = s;
  return;
 }
 if ((c[l >> 2] | 0) >>> 0 <= 4e3) {
  q = ((c[k >> 2] | 0) >>> 0) % ((c[l >> 2] | 0) >>> 0) | 0;
  r = c[l >> 2] | 0;
  c[g >> 2] = ((c[k >> 2] | 0) >>> 0) / ((c[l >> 2] | 0) >>> 0) | 0;
  c[g + 4 >> 2] = q;
  c[g + 8 >> 2] = r;
  Xi(o, 28427, g) | 0;
  r = c[m >> 2] | 0;
  lh(r, 28504, o);
  i = s;
  return;
 }
 c[n >> 2] = ((c[l >> 2] | 0) >>> 0) / 4e3 | 0;
 c[p >> 2] = ((c[l >> 2] | 0) >>> 0) % 4e3 | 0;
 if ((c[n >> 2] | 0) >>> 0 <= 1) {
  q = ((c[k >> 2] | 0) >>> 0) % ((c[l >> 2] | 0) >>> 0) | 0;
  r = c[p >> 2] | 0;
  c[h >> 2] = ((c[k >> 2] | 0) >>> 0) / ((c[l >> 2] | 0) >>> 0) | 0;
  c[h + 4 >> 2] = q;
  c[h + 8 >> 2] = r;
  Xi(o, 28467, h) | 0;
  r = c[m >> 2] | 0;
  lh(r, 28504, o);
  i = s;
  return;
 }
 e = ((c[k >> 2] | 0) >>> 0) / ((c[l >> 2] | 0) >>> 0) | 0;
 a = ((c[k >> 2] | 0) >>> 0) % ((c[l >> 2] | 0) >>> 0) | 0;
 d = c[n >> 2] | 0;
 b = c[l >> 2] | 0;
 if ((c[p >> 2] | 0) >>> 0 > 0) {
  n = ((b - (c[p >> 2] | 0) | 0) >>> 0) / ((c[n >> 2] | 0) >>> 0) | 0;
  q = c[p >> 2] | 0;
  c[r >> 2] = e;
  c[r + 4 >> 2] = a;
  c[r + 8 >> 2] = d;
  c[r + 12 >> 2] = n;
  c[r + 16 >> 2] = q;
  Xi(o, 28436, r) | 0;
  r = c[m >> 2] | 0;
  lh(r, 28504, o);
  i = s;
  return;
 } else {
  r = (b >>> 0) / ((c[n >> 2] | 0) >>> 0) | 0;
  c[q >> 2] = e;
  c[q + 4 >> 2] = a;
  c[q + 8 >> 2] = d;
  c[q + 12 >> 2] = r;
  Xi(o, 28453, q) | 0;
  r = c[m >> 2] | 0;
  lh(r, 28504, o);
  i = s;
  return;
 }
}

function Ie() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 h = i;
 i = i + 48 | 0;
 e = h + 32 | 0;
 f = h + 16 | 0;
 b = h;
 if (!(id() | 0)) {
  _b();
  Qi(15176, c[11] | 0) | 0;
  Qi(15176, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(15176, c[11] | 0) | 0;
  Qi(15176, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(15176, c[11] | 0) | 0;
  Qi(15176, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 }
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   b = 19;
   break;
  }
  ed(125, 37, 37);
  if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
   b = 10;
   break;
  }
  Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
  c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
  g = c[332] | 0;
  if (c[263] | 0) {
   b = 12;
   break;
  }
  a[(c[166] | 0) + g >> 0] = 8;
  c[(c[271] | 0) + (c[332] << 2) >> 2] = c[715];
  a : do if ((c[715] | 0) == (c[716] | 0)) {
   g = c[11] | 0;
   j = (c[716] | 0) + 10 | 0;
   l = c[716] | 0;
   c[b >> 2] = 15184;
   c[b + 4 >> 2] = 4;
   c[b + 8 >> 2] = j;
   c[b + 12 >> 2] = l;
   $i(g, 9481, b) | 0;
   c[395] = mh(c[395] | 0, (c[716] | 0) + 10 + 1 << 2) | 0;
   g = c[11] | 0;
   l = (c[329] | 0) + 1 | 0;
   j = (c[716] | 0) + 10 | 0;
   k = c[716] | 0;
   c[f >> 2] = 15196;
   c[f + 4 >> 2] = l;
   c[f + 8 >> 2] = j;
   c[f + 12 >> 2] = k;
   $i(g, 9481, f) | 0;
   c[397] = mh(c[397] | 0, _((c[716] | 0) + 10 | 0, (c[329] | 0) + 1 | 0) | 0) | 0;
   g = c[11] | 0;
   k = (c[716] | 0) + 10 | 0;
   j = c[716] | 0;
   c[e >> 2] = 15208;
   c[e + 4 >> 2] = 4;
   c[e + 8 >> 2] = k;
   c[e + 12 >> 2] = j;
   $i(g, 9481, e) | 0;
   c[398] = mh(c[398] | 0, (c[716] | 0) + 10 + 1 << 2) | 0;
   c[716] = (c[716] | 0) + 10;
   c[394] = c[715];
   while (1) {
    if ((c[394] | 0) >= (c[716] | 0)) break a;
    c[(c[395] | 0) + (c[394] << 2) >> 2] = 0;
    c[(c[398] | 0) + (c[394] << 2) >> 2] = 0;
    c[394] = (c[394] | 0) + 1;
   }
  } while (0);
  c[715] = (c[715] | 0) + 1;
  if (!(id() | 0)) {
   b = 18;
   break;
  }
 }
 if ((b | 0) == 10) {
  cc();
  Qi(15176, c[11] | 0) | 0;
  Qi(15176, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 } else if ((b | 0) == 12) {
  fc(g);
  i = h;
  return;
 } else if ((b | 0) == 18) {
  _b();
  Qi(15176, c[11] | 0) | 0;
  Qi(15176, c[12] | 0) | 0;
  Yb();
  i = h;
  return;
 } else if ((b | 0) == 19) {
  c[67] = (c[67] | 0) + 1;
  i = h;
  return;
 }
}

function Bf(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 r = i;
 i = i + 64 | 0;
 p = r + 8 | 0;
 o = r;
 e = r + 60 | 0;
 h = r + 56 | 0;
 f = r + 52 | 0;
 j = r + 48 | 0;
 s = r + 40 | 0;
 l = r + 32 | 0;
 g = r + 28 | 0;
 k = r + 24 | 0;
 n = r + 20 | 0;
 m = r + 16 | 0;
 q = r + 12 | 0;
 c[e >> 2] = b;
 c[j >> 2] = ef(c[e >> 2] | 0, 8) | 0;
 b = (c[e >> 2] | 0) + 8 | 0;
 cg(s, 751);
 c[b >> 2] = c[s >> 2];
 c[b + 4 >> 2] = c[s + 4 >> 2];
 c[h >> 2] = rg(c[e >> 2] | 0, c[j >> 2] | 0, 20037) | 0;
 if (c[h >> 2] | 0) if (c[c[h >> 2] >> 2] | 0) {
  c[f >> 2] = c[h >> 2];
  while (1) {
   if (!(c[c[f >> 2] >> 2] | 0)) break;
   c[g >> 2] = hh(c[c[f >> 2] >> 2] | 0, 20591) | 0;
   if (c[c[e >> 2] >> 2] | 0) eb[c[c[e >> 2] >> 2] & 7](c[c[f >> 2] >> 2] | 0);
   while (1) {
    s = lg(c[g >> 2] | 0) | 0;
    c[l >> 2] = s;
    if (!s) break;
    c[k >> 2] = si(c[l >> 2] | 0) | 0;
    while (1) {
     if ((c[k >> 2] | 0) >>> 0 <= 0) break;
     if (!(hi(a[(c[l >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] | 0) | 0)) break;
     if (!(ni(d[(c[l >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] | 0) | 0)) break;
     a[(c[l >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] = 0;
     c[k >> 2] = (c[k >> 2] | 0) + -1;
    }
    while (1) {
     if ((c[k >> 2] | 0) >>> 0 <= 0) break;
     if ((a[(c[l >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] | 0) != 92) break;
     c[n >> 2] = lg(c[g >> 2] | 0) | 0;
     a[(c[l >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] = 0;
     if (c[n >> 2] | 0) {
      c[m >> 2] = Df(c[l >> 2] | 0, c[n >> 2] | 0) | 0;
      Cj(c[l >> 2] | 0);
      c[l >> 2] = c[m >> 2];
      c[k >> 2] = si(c[l >> 2] | 0) | 0;
      continue;
     } else {
      Qi(28730, c[1840] | 0) | 0;
      s = c[1840] | 0;
      c[o >> 2] = c[c[f >> 2] >> 2];
      $i(s, 20047, o) | 0;
      Qi(29463, c[1840] | 0) | 0;
      ij(c[1840] | 0) | 0;
      continue;
     }
    }
    Cf(c[e >> 2] | 0, c[l >> 2] | 0);
    Cj(c[l >> 2] | 0);
   }
   ih(c[g >> 2] | 0, c[c[f >> 2] >> 2] | 0);
   Cj(c[c[f >> 2] >> 2] | 0);
   c[f >> 2] = (c[f >> 2] | 0) + 4;
  }
  Cj(c[h >> 2] | 0);
  i = r;
  return;
 }
 c[q >> 2] = Ka(20091) | 0;
 if ((c[q >> 2] | 0) != 0 & (c[q >> 2] | 0) != 0) if (!(Ci(c[q >> 2] | 0, 20108) | 0)) {
  i = r;
  return;
 }
 Qi(28730, c[1840] | 0) | 0;
 s = c[1840] | 0;
 c[p >> 2] = c[j >> 2];
 $i(s, 20110, p) | 0;
 Qi(29463, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 i = r;
 return;
}

function bh(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0;
 q = i;
 i = i + 64 | 0;
 o = q + 8 | 0;
 n = q;
 f = q + 60 | 0;
 g = q + 56 | 0;
 k = q + 52 | 0;
 j = q + 48 | 0;
 h = q + 36 | 0;
 r = q + 24 | 0;
 l = q + 20 | 0;
 m = q + 16 | 0;
 c[f >> 2] = b;
 c[g >> 2] = e;
 yh(r);
 c[h >> 2] = c[r >> 2];
 c[h + 4 >> 2] = c[r + 4 >> 2];
 c[h + 8 >> 2] = c[r + 8 >> 2];
 c[k >> 2] = c[g >> 2];
 while (1) {
  if (!(a[c[k >> 2] >> 0] | 0)) break;
  b = c[k >> 2] | 0;
  do if ((a[c[k >> 2] >> 0] | 0) == 36) {
   c[k >> 2] = b + 1;
   if (hi(a[c[k >> 2] >> 0] | 0) | 0) {
    if (!(gi(d[c[k >> 2] >> 0] | 0) | 0)) p = 6;
   } else p = 6;
   if ((p | 0) == 6) {
    p = 0;
    if ((a[c[k >> 2] >> 0] | 0) != 95) {
     if ((a[c[k >> 2] >> 0] | 0) != 123) {
      Qi(28730, c[1840] | 0) | 0;
      r = c[1840] | 0;
      e = a[c[k >> 2] >> 0] | 0;
      c[o >> 2] = c[g >> 2];
      c[o + 4 >> 2] = e;
      $i(r, 28775, o) | 0;
      Qi(29463, c[1840] | 0) | 0;
      ij(c[1840] | 0) | 0;
      Ch(h, (c[k >> 2] | 0) + -1 | 0, 2);
      break;
     }
     r = (c[k >> 2] | 0) + 1 | 0;
     c[k >> 2] = r;
     c[m >> 2] = r;
     while (1) {
      if (a[c[m >> 2] >> 0] | 0) b = (a[c[m >> 2] >> 0] | 0) == 125 ^ 1; else b = 0;
      e = c[m >> 2] | 0;
      if (!b) break;
      c[m >> 2] = e + 1;
     }
     if (a[e >> 0] | 0) {
      ch(c[f >> 2] | 0, h, c[k >> 2] | 0, (c[m >> 2] | 0) + -1 | 0) | 0;
      c[k >> 2] = c[m >> 2];
      break;
     } else {
      Qi(28730, c[1840] | 0) | 0;
      r = c[1840] | 0;
      c[n >> 2] = c[g >> 2];
      $i(r, 28740, n) | 0;
      Qi(29463, c[1840] | 0) | 0;
      ij(c[1840] | 0) | 0;
      c[k >> 2] = (c[m >> 2] | 0) + -1;
      break;
     }
    }
   }
   c[l >> 2] = c[k >> 2];
   while (1) {
    c[l >> 2] = (c[l >> 2] | 0) + 1;
    if (hi(a[c[l >> 2] >> 0] | 0) | 0) if (gi(d[c[l >> 2] >> 0] | 0) | 0) continue;
    if ((a[c[l >> 2] >> 0] | 0) != 95) break;
   }
   c[l >> 2] = (c[l >> 2] | 0) + -1;
   if (!(ch(c[f >> 2] | 0, h, c[k >> 2] | 0, c[l >> 2] | 0) | 0)) Ch(h, (c[k >> 2] | 0) + -1 | 0, (c[l >> 2] | 0) - (c[k >> 2] | 0) + 1 + 1 | 0);
   c[k >> 2] = c[l >> 2];
  } else Bh(h, a[b >> 0] | 0); while (0);
  c[k >> 2] = (c[k >> 2] | 0) + 1;
 }
 Bh(h, 0);
 c[j >> 2] = c[h >> 2];
 i = q;
 return c[j >> 2] | 0;
}

function qe() {
 var a = 0, b = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 f = i;
 i = i + 48 | 0;
 b = f + 32 | 0;
 e = f + 16 | 0;
 a = f;
 if (c[688] | 0) {
  Lb(0);
  Kb();
  i = f;
  return;
 }
 c[688] = 1;
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   a = 20;
   break;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(bd(125, 44) | 0)) {
   a = 6;
   break;
  }
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
   a = 8;
   break;
  }
  if ((c[21] | 0) > ((c[67] | 0) + 1 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   a = 11;
   break;
  }
  if ((c[115] | 0) == (c[689] | 0)) {
   g = c[11] | 0;
   j = (c[689] | 0) + 20 | 0;
   h = c[689] | 0;
   c[a >> 2] = 13832;
   c[a + 4 >> 2] = 4;
   c[a + 8 >> 2] = j;
   c[a + 12 >> 2] = h;
   $i(g, 9481, a) | 0;
   c[116] = mh(c[116] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
   g = c[11] | 0;
   h = (c[689] | 0) + 20 | 0;
   j = c[689] | 0;
   c[e >> 2] = 13841;
   c[e + 4 >> 2] = 4;
   c[e + 8 >> 2] = h;
   c[e + 12 >> 2] = j;
   $i(g, 9481, e) | 0;
   c[338] = mh(c[338] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
   g = c[11] | 0;
   j = (c[689] | 0) + 20 | 0;
   h = c[689] | 0;
   c[b >> 2] = 13850;
   c[b + 4 >> 2] = 4;
   c[b + 8 >> 2] = j;
   c[b + 12 >> 2] = h;
   $i(g, 9481, b) | 0;
   c[347] = mh(c[347] | 0, (c[689] | 0) + 20 + 1 << 2) | 0;
   c[689] = (c[689] | 0) + 20;
  }
  j = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 6, 1) | 0;
  c[(c[116] | 0) + (c[115] << 2) >> 2] = c[(c[167] | 0) + (j << 2) >> 2];
  if (c[263] | 0) {
   a = 15;
   break;
  }
  Jc(c[(c[116] | 0) + (c[115] << 2) >> 2] | 0);
  if (!(mf((c[70] | 0) + 1 | 0) | 0)) {
   a = 18;
   break;
  }
  if (!(Ue((c[338] | 0) + (c[115] << 2) | 0, 6, 13669) | 0)) {
   a = 18;
   break;
  }
  c[115] = (c[115] | 0) + 1;
 }
 if ((a | 0) == 6) {
  Mb();
  Kb();
  i = f;
  return;
 } else if ((a | 0) == 8) {
  Ob();
  Kb();
  i = f;
  return;
 } else if ((a | 0) == 11) {
  Nb();
  Kb();
  i = f;
  return;
 } else if ((a | 0) == 15) {
  Qi(13861, c[11] | 0) | 0;
  Qi(13861, c[12] | 0) | 0;
  Pb();
  Kb();
  i = f;
  return;
 } else if ((a | 0) == 18) {
  Qi(13905, c[11] | 0) | 0;
  Qi(13905, c[12] | 0) | 0;
  Pb();
  Kb();
  i = f;
  return;
 } else if ((a | 0) == 20) {
  i = f;
  return;
 }
}

function sj(b, d, e, f, g, h) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 var i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 i = c[1780] | 0;
 if ((i | 0) == 0 | (c[1782] | 0) != 0) {
  c[1782] = 0;
  c[1783] = 0;
  c[1780] = 1;
  i = 1;
 }
 a : do if ((i | 0) < (b | 0)) {
  l = c[d + (i << 2) >> 2] | 0;
  if (!l) i = -1; else if ((a[l >> 0] | 0) == 45) {
   k = l + 1 | 0;
   j = a[k >> 0] | 0;
   if (!h) {
    if (j << 24 >> 24 == 45) if (a[l + 2 >> 0] | 0) {
     j = 45;
     o = 10;
    }
   } else if (j << 24 >> 24) o = 10;
   if ((o | 0) == 10) {
    h = c[f >> 2] | 0;
    n = j << 24 >> 24 == 45;
    b : do if (h) {
     m = n ? l + 2 | 0 : k;
     k = h;
     h = 0;
     c : while (1) {
      j = a[k >> 0] | 0;
      d : do if (!(j << 24 >> 24)) {
       j = m;
       o = 15;
      } else {
       l = j;
       j = m;
       while (1) {
        if (l << 24 >> 24 != (a[j >> 0] | 0)) break d;
        k = k + 1 | 0;
        j = j + 1 | 0;
        l = a[k >> 0] | 0;
        if (!(l << 24 >> 24)) {
         o = 15;
         break;
        }
       }
      } while (0);
      e : do if ((o | 0) == 15) {
       o = 0;
       k = a[j >> 0] | 0;
       switch (k << 24 >> 24) {
       case 61:
       case 0:
        break;
       default:
        break e;
       }
       l = c[f + (h << 4) + 4 >> 2] | 0;
       if (k << 24 >> 24 != 61) {
        j = l;
        o = 19;
        break c;
       }
       if (l) {
        o = 18;
        break c;
       }
      } while (0);
      h = h + 1 | 0;
      k = c[f + (h << 4) >> 2] | 0;
      if (!k) break b;
     }
     do if ((o | 0) == 18) c[1785] = j + 1; else if ((o | 0) == 19) if ((j | 0) == 1) {
      i = i + 1 | 0;
      c[1780] = i;
      o = c[d + (i << 2) >> 2] | 0;
      c[1785] = o;
      if (!o) {
       i = 58;
       break a;
      } else break;
     } else {
      c[1785] = 0;
      break;
     } while (0);
     c[1780] = i + 1;
     if (g) c[g >> 2] = h;
     j = c[f + (h << 4) + 8 >> 2] | 0;
     i = c[f + (h << 4) + 12 >> 2] | 0;
     if (!j) break a;
     c[j >> 2] = i;
     i = 0;
     break a;
    } while (0);
    if (n) {
     c[1780] = i + 1;
     i = 63;
     break;
    }
   }
   i = Oh(b, d, e) | 0;
  } else i = -1;
 } else i = -1; while (0);
 return i | 0;
}

function se() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 16 | 0;
 h = j + 8 | 0;
 g = j;
 c[692] = 1;
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   b = 24;
   break;
  }
  c[67] = (c[67] | 0) + 1;
  if (!(bd(125, 44) | 0)) {
   b = 4;
   break;
  }
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
   b = 6;
   break;
  }
  if ((c[21] | 0) > ((c[67] | 0) + 1 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   b = 9;
   break;
  }
  if (((c[67] | 0) - (c[66] | 0) | 0) == 1) if ((d[(c[15] | 0) + (c[66] | 0) >> 0] | 0 | 0) == 42) {
   if (c[350] | 0) {
    b = 13;
    break;
   }
   c[350] = 1;
   c[693] = c[172];
   continue;
  }
  c[274] = c[66];
  while (1) {
   if ((c[274] | 0) >= (c[67] | 0)) break;
   a[(c[17] | 0) + (c[274] | 0) >> 0] = a[(c[15] | 0) + (c[274] | 0) >> 0] | 0;
   c[274] = (c[274] | 0) + 1;
  }
  Oc(c[17] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
  c[272] = Qc(c[17] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 10, 1) | 0;
  b = c[15] | 0;
  e = c[66] | 0;
  f = (c[67] | 0) - (c[66] | 0) | 0;
  if (c[263] | 0) {
   c[694] = Qc(b, e, f, 9, 0) | 0;
   if (c[263] | 0) continue; else {
    b = 20;
    break;
   }
  }
  c[270] = Qc(b, e, f, 9, 1) | 0;
  if (c[263] | 0) Tb();
  Ub(c[172] | 0);
  c[(c[121] | 0) + (c[172] << 2) >> 2] = c[(c[167] | 0) + (c[270] << 2) >> 2];
  c[(c[271] | 0) + (c[270] << 2) >> 2] = c[172];
  c[(c[271] | 0) + (c[272] << 2) >> 2] = c[270];
  c[172] = (c[172] | 0) + 1;
 }
 if ((b | 0) == 4) {
  Mb();
  Kb();
  i = j;
  return;
 } else if ((b | 0) == 6) {
  Ob();
  Kb();
  i = j;
  return;
 } else if ((b | 0) == 9) {
  Nb();
  Kb();
  i = j;
  return;
 } else if ((b | 0) == 13) {
  f = c[11] | 0;
  c[g >> 2] = 14012;
  $i(f, 16602, g) | 0;
  g = c[12] | 0;
  c[h >> 2] = 14012;
  $i(g, 16602, h) | 0;
  Kb();
  i = j;
  return;
 } else if ((b | 0) == 20) {
  Qi(14051, c[11] | 0) | 0;
  Qi(14051, c[12] | 0) | 0;
  Db();
  Qi(14090, c[11] | 0) | 0;
  Qi(14090, c[12] | 0) | 0;
  Ab(c[(c[121] | 0) + (c[(c[271] | 0) + (c[(c[271] | 0) + (c[272] << 2) >> 2] << 2) >> 2] << 2) >> 2] | 0);
  rb();
  Kb();
  i = j;
  return;
 } else if ((b | 0) == 24) {
  i = j;
  return;
 }
}

function te() {
 var b = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 48 | 0;
 f = j + 32 | 0;
 h = j + 16 | 0;
 g = j + 8 | 0;
 e = j;
 b = j + 44 | 0;
 c[67] = (c[67] | 0) + 1;
 if (!($c(125) | 0)) {
  Mb();
  Kb();
  i = j;
  return;
 }
 if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
  Ob();
  Kb();
  i = j;
  return;
 }
 if ((c[21] | 0) > ((c[67] | 0) + 1 | 0)) {
  Nb();
  Kb();
  i = j;
  return;
 }
 c[72] = (c[72] | 0) + 1;
 if ((c[72] | 0) == 20) {
  Db();
  Qi(14096, c[11] | 0) | 0;
  Qi(14096, c[12] | 0) | 0;
  vb();
  k = c[11] | 0;
  c[e >> 2] = 14099;
  c[e + 4 >> 2] = 20;
  $i(k, 11369, e) | 0;
  e = c[12] | 0;
  c[g >> 2] = 14099;
  c[g + 4 >> 2] = 20;
  $i(e, 11369, g) | 0;
  xa(96, 1);
 }
 c[b >> 2] = 1;
 if (((c[67] | 0) - (c[66] | 0) | 0) < ((c[(c[63] | 0) + ((c[281] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[281] << 2) >> 2] | 0) | 0)) c[b >> 2] = 0; else if (!(Mc(c[281] | 0, c[15] | 0, (c[67] | 0) - ((c[(c[63] | 0) + ((c[281] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[281] << 2) >> 2] | 0)) | 0, (c[(c[63] | 0) + ((c[281] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[281] << 2) >> 2] | 0) | 0) | 0)) c[b >> 2] = 0;
 if (!(c[b >> 2] | 0)) {
  Db();
  Qi(14121, c[11] | 0) | 0;
  Qi(14121, c[12] | 0) | 0;
  c[72] = (c[72] | 0) - 1;
  Kb();
  i = j;
  return;
 }
 k = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 3, 1) | 0;
 c[292 + (c[72] << 2) >> 2] = c[(c[167] | 0) + (k << 2) >> 2];
 if (c[263] | 0) {
  Qi(14144, c[11] | 0) | 0;
  Qi(14144, c[12] | 0) | 0;
  Ib();
  c[72] = (c[72] | 0) - 1;
  Kb();
  i = j;
  return;
 }
 Jc(c[292 + (c[72] << 2) >> 2] | 0);
 c[68] = (c[71] | 0) + 1;
 a[(c[70] | 0) + (c[68] | 0) >> 0] = 0;
 if (mf((c[70] | 0) + 1 | 0) | 0) if (Ue(2664 + (c[72] << 2) | 0, -1, 13669) | 0) {
  k = c[11] | 0;
  g = c[72] | 0;
  c[h >> 2] = 14202;
  c[h + 4 >> 2] = g;
  c[h + 8 >> 2] = 14211;
  $i(k, 9764, h) | 0;
  k = c[12] | 0;
  h = c[72] | 0;
  c[f >> 2] = 14202;
  c[f + 4 >> 2] = h;
  c[f + 8 >> 2] = 14211;
  $i(k, 9764, f) | 0;
  Ib();
  c[376 + (c[72] << 2) >> 2] = 0;
  i = j;
  return;
 }
 Qi(14170, c[11] | 0) | 0;
 Qi(14170, c[12] | 0) | 0;
 Ib();
 c[72] = (c[72] | 0) - 1;
 Kb();
 i = j;
 return;
}

function Wf(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 r = i;
 i = i + 96 | 0;
 m = r + 80 | 0;
 p = r;
 f = r + 76 | 0;
 g = r + 72 | 0;
 o = r + 64 | 0;
 l = r + 56 | 0;
 n = r + 48 | 0;
 k = r + 40 | 0;
 t = r + 32 | 0;
 s = r + 24 | 0;
 h = r + 16 | 0;
 j = r + 8 | 0;
 c[f >> 2] = d;
 c[g >> 2] = e;
 Xf(t);
 c[o >> 2] = c[t >> 2];
 c[o + 4 >> 2] = c[t + 4 >> 2];
 Xf(s);
 c[l >> 2] = c[s >> 2];
 c[l + 4 >> 2] = c[s + 4 >> 2];
 c[k >> 2] = c[c[g >> 2] >> 2];
 while (1) {
  if (!(a[c[k >> 2] >> 0] | 0)) {
   q = 17;
   break;
  }
  if ((a[c[k >> 2] >> 0] | 0) == 125) {
   q = 17;
   break;
  }
  a : do if ((a[c[k >> 2] >> 0] | 0) == 58) q = 6; else if ((a[c[k >> 2] >> 0] | 0) == 44) q = 6; else {
   if ((a[c[k >> 2] >> 0] | 0) == 123) {
    Yf(l, c[c[g >> 2] >> 2] | 0, c[k >> 2] | 0);
    c[k >> 2] = (c[k >> 2] | 0) + 1;
    Wf(j, c[f >> 2] | 0, k);
    c[n >> 2] = c[j >> 2];
    c[n + 4 >> 2] = c[j + 4 >> 2];
    c[m >> 2] = c[n >> 2];
    c[m + 4 >> 2] = c[n + 4 >> 2];
    Og(l, m);
    Pg(n);
    if ((a[c[k >> 2] >> 0] | 0) != 125) {
     Qi(28730, c[1840] | 0) | 0;
     t = c[1840] | 0;
     c[p >> 2] = c[c[g >> 2] >> 2];
     $i(t, 20552, p) | 0;
     Qi(29463, c[1840] | 0) | 0;
     ij(c[1840] | 0) | 0;
    }
    c[c[g >> 2] >> 2] = (c[k >> 2] | 0) + 1;
    break;
   }
   if ((a[c[k >> 2] >> 0] | 0) == 36) if ((a[(c[k >> 2] | 0) + 1 >> 0] | 0) == 123) {
    c[k >> 2] = (c[k >> 2] | 0) + 2;
    while (1) {
     if ((a[c[k >> 2] >> 0] | 0) == 125) break a;
     c[k >> 2] = (c[k >> 2] | 0) + 1;
    }
   }
  } while (0);
  if ((q | 0) == 6) {
   q = 0;
   Yf(l, c[c[g >> 2] >> 2] | 0, c[k >> 2] | 0);
   c[m >> 2] = c[l >> 2];
   c[m + 4 >> 2] = c[l + 4 >> 2];
   Ng(o, m);
   Pg(l);
   c[c[g >> 2] >> 2] = (c[k >> 2] | 0) + 1;
   Xf(h);
   c[l >> 2] = c[h >> 2];
   c[l + 4 >> 2] = c[h + 4 >> 2];
  }
  c[k >> 2] = (c[k >> 2] | 0) + 1;
 }
 if ((q | 0) == 17) {
  Yf(l, c[c[g >> 2] >> 2] | 0, c[k >> 2] | 0);
  c[m >> 2] = c[l >> 2];
  c[m + 4 >> 2] = c[l + 4 >> 2];
  Ng(o, m);
  Pg(l);
  c[c[g >> 2] >> 2] = c[k >> 2];
  c[b >> 2] = c[o >> 2];
  c[b + 4 >> 2] = c[o + 4 >> 2];
  i = r;
  return;
 }
}

function Mf(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0;
 r = i;
 i = i + 48 | 0;
 g = r;
 h = r + 40 | 0;
 j = r + 36 | 0;
 k = r + 32 | 0;
 p = r + 28 | 0;
 q = r + 24 | 0;
 l = r + 20 | 0;
 n = r + 16 | 0;
 m = r + 12 | 0;
 o = r + 8 | 0;
 c[h >> 2] = b;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[n >> 2] = 0;
 c[m >> 2] = Qf(c[k >> 2] | 0, 20591) | 0;
 if (!(c[m >> 2] | 0)) {
  q = c[m >> 2] | 0;
  q = (q | 0) != 0;
  q = q & 1;
  i = r;
  return q | 0;
 }
 while (1) {
  e = lg(c[m >> 2] | 0) | 0;
  c[p >> 2] = e;
  if (!e) break;
  if (a[c[p >> 2] >> 0] | 0) if ((a[c[p >> 2] >> 0] | 0) != 37) if ((a[c[p >> 2] >> 0] | 0) != 35) {
   c[q >> 2] = c[p >> 2];
   while (1) {
    if (a[c[q >> 2] >> 0] | 0) if (hi(a[c[q >> 2] >> 0] | 0) | 0) f = (ni(d[c[q >> 2] >> 0] | 0) | 0) != 0; else f = 0; else f = 0;
    b = c[q >> 2] | 0;
    if (!f) break;
    c[q >> 2] = b + 1;
   }
   c[l >> 2] = b;
   do {
    if (a[c[l >> 2] >> 0] | 0) {
     if (hi(a[c[l >> 2] >> 0] | 0) | 0) f = (ni(d[c[l >> 2] >> 0] | 0) | 0) != 0; else f = 0;
     f = f ^ 1;
    } else f = 0;
    b = c[l >> 2] | 0;
    c[l >> 2] = b + 1;
   } while (f);
   a[b >> 0] = 0;
   while (1) {
    if (!(a[c[l >> 2] >> 0] | 0)) break;
    if (!(hi(a[c[l >> 2] >> 0] | 0) | 0)) break;
    if (!(ni(d[c[l >> 2] >> 0] | 0) | 0)) break;
    c[l >> 2] = (c[l >> 2] | 0) + 1;
   }
   if (si(c[q >> 2] | 0) | 0) if (si(c[l >> 2] | 0) | 0) {
    b = c[j >> 2] | 0;
    e = nh(c[l >> 2] | 0) | 0;
    eg(b, e, nh(c[q >> 2] | 0) | 0);
    c[n >> 2] = (c[n >> 2] | 0) + 1;
   }
  }
  Cj(c[p >> 2] | 0);
 }
 if (c[(c[h >> 2] | 0) + 44 >> 2] & 2) {
  c[o >> 2] = 1;
  Qi(29466, c[1840] | 0) | 0;
  p = c[1840] | 0;
  q = c[n >> 2] | 0;
  c[g >> 2] = c[k >> 2];
  c[g + 4 >> 2] = q;
  $i(p, 20297, g) | 0;
  ij(c[1840] | 0) | 0;
  Qi(29466, c[1840] | 0) | 0;
  Qi(20314, c[1840] | 0) | 0;
  ij(c[1840] | 0) | 0;
  p = c[j >> 2] | 0;
  q = c[o >> 2] | 0;
  c[g >> 2] = c[p >> 2];
  c[g + 4 >> 2] = c[p + 4 >> 2];
  gg(g, q);
  ij(c[1840] | 0) | 0;
 }
 ih(c[m >> 2] | 0, c[k >> 2] | 0);
 q = c[m >> 2] | 0;
 q = (q | 0) != 0;
 q = q & 1;
 i = r;
 return q | 0;
}

function Oh(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 m = i;
 i = i + 16 | 0;
 l = m + 4 | 0;
 k = m;
 f = c[1780] | 0;
 if ((f | 0) == 0 | (c[1782] | 0) != 0) {
  c[1782] = 0;
  c[1783] = 0;
  c[1780] = 1;
  f = 1;
 }
 a : do if ((f | 0) < (b | 0)) {
  g = c[d + (f << 2) >> 2] | 0;
  if (!g) f = -1; else if ((a[g >> 0] | 0) == 45) {
   switch (a[g + 1 >> 0] | 0) {
   case 0:
    {
     f = -1;
     break a;
    }
   case 45:
    {
     if (!(a[g + 2 >> 0] | 0)) {
      c[1780] = f + 1;
      f = -1;
      break a;
     }
     break;
    }
   default:
    {}
   }
   f = c[1783] | 0;
   if (!f) {
    c[1783] = 1;
    f = 1;
   }
   f = fi(l, g + f | 0, 4) | 0;
   if ((f | 0) < 0) {
    c[l >> 2] = 65533;
    g = 65533;
    j = 1;
   } else {
    g = c[l >> 2] | 0;
    j = f;
   }
   f = c[1780] | 0;
   n = c[d + (f << 2) >> 2] | 0;
   o = c[1783] | 0;
   h = n + o | 0;
   c[1784] = g;
   g = o + j | 0;
   c[1783] = g;
   if (!(a[n + g >> 0] | 0)) {
    c[1780] = f + 1;
    c[1783] = 0;
   }
   f = fi(k, e, 4) | 0;
   b : do if (!f) g = 0; else {
    g = 0;
    do {
     if ((c[k >> 2] | 0) == (c[l >> 2] | 0)) break b;
     g = ((f | 0) < 1 ? 1 : f) + g | 0;
     f = fi(k, e + g | 0, 4) | 0;
    } while ((f | 0) != 0);
   } while (0);
   f = c[k >> 2] | 0;
   if ((f | 0) != (c[l >> 2] | 0)) {
    if (!((a[e >> 0] | 0) != 58 & (c[1781] | 0) != 0)) {
     f = 63;
     break;
    }
    f = c[d >> 2] | 0;
    Zh(2, f, si(f) | 0) | 0;
    Zh(2, 29496, 18) | 0;
    Zh(2, h, j) | 0;
    Zh(2, 29515, 1) | 0;
    f = 63;
    break;
   }
   if ((a[e + (g + 1) >> 0] | 0) == 58) {
    g = c[1780] | 0;
    if ((g | 0) < (b | 0)) {
     c[1780] = g + 1;
     c[1785] = (c[d + (g << 2) >> 2] | 0) + (c[1783] | 0);
     c[1783] = 0;
     break;
    }
    if ((a[e >> 0] | 0) == 58) f = 58; else if (!(c[1781] | 0)) f = 63; else {
     f = c[d >> 2] | 0;
     Zh(2, f, si(f) | 0) | 0;
     Zh(2, 29517, 31) | 0;
     Zh(2, h, j) | 0;
     Zh(2, 29515, 1) | 0;
     f = 63;
    }
   }
  } else f = -1;
 } else f = -1; while (0);
 i = m;
 return f | 0;
}

function gg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0.0;
 q = i;
 i = i + 80 | 0;
 p = q + 24 | 0;
 m = q + 16 | 0;
 l = q + 8 | 0;
 k = q;
 d = q + 72 | 0;
 e = q + 68 | 0;
 o = q + 64 | 0;
 n = q + 60 | 0;
 f = q + 56 | 0;
 g = q + 52 | 0;
 j = q + 48 | 0;
 c[d >> 2] = b;
 c[o >> 2] = 0;
 c[n >> 2] = 0;
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) >>> 0 >= (c[a + 4 >> 2] | 0) >>> 0) break;
  c[f >> 2] = c[(c[a >> 2] | 0) + (c[e >> 2] << 2) >> 2];
  if (c[f >> 2] | 0) {
   c[g >> 2] = 1;
   c[n >> 2] = (c[n >> 2] | 0) + 1;
   if (!(c[d >> 2] | 0)) {
    b = c[1840] | 0;
    c[k >> 2] = c[e >> 2];
    $i(b, 20813, k) | 0;
   }
   c[j >> 2] = c[(c[f >> 2] | 0) + 8 >> 2];
   while (1) {
    if (!(c[j >> 2] | 0)) break;
    c[g >> 2] = (c[g >> 2] | 0) + 1;
    c[j >> 2] = c[(c[j >> 2] | 0) + 8 >> 2];
   }
   if (!(c[d >> 2] | 0)) {
    b = c[1840] | 0;
    c[l >> 2] = c[g >> 2];
    $i(b, 20818, l) | 0;
   }
   c[o >> 2] = (c[o >> 2] | 0) + (c[g >> 2] | 0);
   if (!(c[d >> 2] | 0)) {
    c[j >> 2] = c[f >> 2];
    while (1) {
     b = c[1840] | 0;
     if (!(c[j >> 2] | 0)) break;
     r = c[(c[j >> 2] | 0) + 4 >> 2] | 0;
     c[m >> 2] = c[c[j >> 2] >> 2];
     c[m + 4 >> 2] = r;
     $i(b, 20824, m) | 0;
     c[j >> 2] = c[(c[j >> 2] | 0) + 8 >> 2];
    }
    Vi(10, b) | 0;
   }
  }
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 e = c[1840] | 0;
 f = c[a + 4 >> 2] | 0;
 g = c[n >> 2] | 0;
 b = (((c[n >> 2] | 0) * 100 | 0) >>> 0) / ((c[a + 4 >> 2] | 0) >>> 0) | 0;
 d = c[o >> 2] | 0;
 if (!(c[n >> 2] | 0)) {
  s = 0.0;
  c[p >> 2] = f;
  r = p + 4 | 0;
  c[r >> 2] = g;
  r = p + 8 | 0;
  c[r >> 2] = b;
  r = p + 12 | 0;
  c[r >> 2] = d;
  r = p + 16 | 0;
  h[r >> 3] = s;
  $i(e, 20832, p) | 0;
  i = q;
  return;
 }
 s = +((c[o >> 2] | 0) >>> 0) / +((c[n >> 2] | 0) >>> 0);
 c[p >> 2] = f;
 r = p + 4 | 0;
 c[r >> 2] = g;
 r = p + 8 | 0;
 c[r >> 2] = b;
 r = p + 12 | 0;
 c[r >> 2] = d;
 r = p + 16 | 0;
 h[r >> 3] = s;
 $i(e, 20832, p) | 0;
 i = q;
 return;
}

function xg(b, d, e, f, g, h) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0, w = 0, x = 0;
 v = i;
 i = i + 80 | 0;
 j = v + 72 | 0;
 k = v + 68 | 0;
 w = v + 64 | 0;
 l = v + 60 | 0;
 m = v + 56 | 0;
 n = v + 52 | 0;
 s = v + 48 | 0;
 u = v + 40 | 0;
 r = v + 32 | 0;
 x = v + 24 | 0;
 t = v + 16 | 0;
 p = v + 12 | 0;
 q = v + 8 | 0;
 o = v;
 c[k >> 2] = d;
 c[w >> 2] = e;
 c[l >> 2] = f;
 c[m >> 2] = g;
 c[n >> 2] = h;
 c[r >> 2] = 0;
 sg(x);
 c[u >> 2] = c[x >> 2];
 c[u + 4 >> 2] = c[x + 4 >> 2];
 c[s >> 2] = mg(c[k >> 2] | 0, c[w >> 2] | 0) | 0;
 while (1) {
  if (!((c[r >> 2] | 0) != 0 ? 0 : (c[s >> 2] | 0) != 0)) break;
  c[p >> 2] = 1;
  if ((a[c[s >> 2] >> 0] | 0) == 33) if ((a[(c[s >> 2] | 0) + 1 >> 0] | 0) == 33) {
   c[p >> 2] = 0;
   c[s >> 2] = (c[s >> 2] | 0) + 2;
  }
  oh(c[k >> 2] | 0, c[s >> 2] | 0) | 0;
  if (c[(c[k >> 2] | 0) + 92 >> 2] | 0) h = If(c[k >> 2] | 0, c[l >> 2] | 0, c[s >> 2] | 0, c[n >> 2] | 0) | 0; else h = 0;
  c[t >> 2] = h;
  do if (c[p >> 2] | 0) {
   if (c[t >> 2] | 0) {
    if (!(c[m >> 2] | 0)) break;
    if (c[(c[t >> 2] | 0) + 4 >> 2] | 0) break;
   }
   c[q >> 2] = ph(c[k >> 2] | 0, c[s >> 2] | 0) | 0;
   if (c[q >> 2] | 0) if (c[c[q >> 2] >> 2] | 0) {
    if (!(c[t >> 2] | 0)) c[t >> 2] = kh(8) | 0;
    x = c[t >> 2] | 0;
    yg(o, c[k >> 2] | 0, c[q >> 2] | 0, c[l >> 2] | 0, c[n >> 2] | 0);
    c[x >> 2] = c[o >> 2];
    c[x + 4 >> 2] = c[o + 4 >> 2];
   }
  } while (0);
  do if (c[t >> 2] | 0) if (c[(c[t >> 2] | 0) + 4 >> 2] | 0) {
   h = c[t >> 2] | 0;
   if (c[n >> 2] | 0) {
    c[j >> 2] = c[h >> 2];
    c[j + 4 >> 2] = c[h + 4 >> 2];
    Ng(u, j);
    break;
   } else {
    Lg(u, c[c[h + 4 >> 2] >> 2] | 0);
    c[r >> 2] = 1;
    break;
   }
  } while (0);
  if (c[t >> 2] | 0) {
   Pg(c[t >> 2] | 0);
   Cj(c[t >> 2] | 0);
  }
  c[s >> 2] = mg(c[k >> 2] | 0, 0) | 0;
 }
 Cj(c[l >> 2] | 0);
 c[b >> 2] = c[u >> 2];
 c[b + 4 >> 2] = c[u + 4 >> 2];
 i = v;
 return;
}

function Ld(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 k = j + 16 | 0;
 f = j + 12 | 0;
 g = j + 8 | 0;
 e = j + 4 | 0;
 h = j;
 c[k >> 2] = b;
 c[260] = c[(c[63] | 0) + (c[k >> 2] << 2) >> 2];
 c[261] = c[(c[63] | 0) + ((c[k >> 2] | 0) + 1 << 2) >> 2];
 while (1) {
  if (((c[175] | 0) + ((c[261] | 0) - (c[260] | 0)) | 0) <= (c[14] | 0)) break;
  xb();
 }
 c[176] = c[175];
 while (1) {
  if ((c[260] | 0) >= (c[261] | 0)) break;
  a[(c[18] | 0) + (c[176] | 0) >> 0] = a[(c[64] | 0) + (c[260] | 0) >> 0] | 0;
  c[260] = (c[260] | 0) + 1;
  c[176] = (c[176] | 0) + 1;
 }
 c[175] = c[176];
 c[h >> 2] = 0;
 while (1) {
  if ((c[175] | 0) <= 79) {
   b = 30;
   break;
  }
  if (!((c[h >> 2] | 0) != 0 ^ 1)) {
   b = 30;
   break;
  }
  c[g >> 2] = c[175];
  c[176] = 79;
  c[e >> 2] = 0;
  while (1) {
   b = c[176] | 0;
   if (!((d[8613 + (d[(c[18] | 0) + (c[176] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1 ? (c[176] | 0) >= 3 : 0)) break;
   c[176] = b - 1;
  }
  a : do if ((b | 0) == 2) {
   c[176] = 80;
   while (1) {
    if ((c[176] | 0) >= (c[g >> 2] | 0)) break;
    if ((d[8613 + (d[(c[18] | 0) + (c[176] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) break;
    c[176] = (c[176] | 0) + 1;
   }
   if ((c[176] | 0) == (c[g >> 2] | 0)) {
    c[h >> 2] = 1;
    break;
   }
   c[e >> 2] = 1;
   while (1) {
    if (((c[176] | 0) + 1 | 0) >= (c[g >> 2] | 0)) break a;
    if ((d[8613 + (d[(c[18] | 0) + ((c[176] | 0) + 1) >> 0] | 0) >> 0] | 0 | 0) != 1) break a;
    c[176] = (c[176] | 0) + 1;
   }
  } else c[e >> 2] = 1; while (0);
  if (!(c[e >> 2] | 0)) continue;
  c[175] = c[176];
  c[f >> 2] = (c[175] | 0) + 1;
  Dc();
  a[c[18] >> 0] = 32;
  a[(c[18] | 0) + 1 >> 0] = 32;
  c[176] = 2;
  c[274] = c[f >> 2];
  while (1) {
   if ((c[274] | 0) >= (c[g >> 2] | 0)) break;
   a[(c[18] | 0) + (c[176] | 0) >> 0] = a[(c[18] | 0) + (c[274] | 0) >> 0] | 0;
   c[176] = (c[176] | 0) + 1;
   c[274] = (c[274] | 0) + 1;
  }
  c[175] = (c[g >> 2] | 0) - (c[f >> 2] | 0) + 2;
 }
 if ((b | 0) == 30) {
  i = j;
  return;
 }
}

function fe() {
 var b = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 Dd(1600, 9387);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(c[323] | 0, 1);
  return;
 }
 if (d[9385] | 0) {
  Ed(c[387] | 0, a[9385] | 0, 0);
  Cd(c[323] | 0, 1);
  return;
 }
 b = c[400] | 0;
 if ((d[9387] | 0 | 0) != 1) {
  Ed(b, a[9387] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 c[388] = (c[(c[63] | 0) + (b + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[400] << 2) >> 2] | 0);
 if ((c[367] | 0) >= (c[388] | 0)) if ((c[387] | 0) == 1 | (c[387] | 0) == -1) {
  if ((c[(c[383] | 0) + (c[382] << 2) >> 2] | 0) >= (c[386] | 0)) {
   c[22] = (c[22] | 0) + 1;
   c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
  }
  c[382] = (c[382] | 0) + 1;
  return;
 }
 if (!((c[367] | 0) <= 0 | (c[387] | 0) == 0)) if ((c[387] | 0) <= (c[388] | 0)) if ((c[387] | 0) >= (0 - (c[388] | 0) | 0)) {
  if ((c[387] | 0) > 0) {
   if ((c[367] | 0) > ((c[388] | 0) - ((c[387] | 0) - 1) | 0)) c[367] = (c[388] | 0) - ((c[387] | 0) - 1);
   c[365] = (c[(c[63] | 0) + (c[400] << 2) >> 2] | 0) + ((c[387] | 0) - 1);
   c[366] = (c[365] | 0) + (c[367] | 0);
   if ((c[387] | 0) == 1) if ((c[400] | 0) >= (c[386] | 0)) {
    c[(c[63] | 0) + ((c[400] | 0) + 1 << 2) >> 2] = c[366];
    c[22] = (c[22] | 0) + 1;
    c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
    c[382] = (c[382] | 0) + 1;
    return;
   }
  } else {
   c[387] = 0 - (c[387] | 0);
   if ((c[367] | 0) > ((c[388] | 0) - ((c[387] | 0) - 1) | 0)) c[367] = (c[388] | 0) - ((c[387] | 0) - 1);
   c[366] = (c[(c[63] | 0) + ((c[400] | 0) + 1 << 2) >> 2] | 0) - ((c[387] | 0) - 1);
   c[365] = (c[366] | 0) - (c[367] | 0);
  }
  while (1) {
   if (((c[259] | 0) + (c[366] | 0) - (c[365] | 0) | 0) <= (c[65] | 0)) break;
   Bb();
  }
  while (1) {
   if ((c[365] | 0) >= (c[366] | 0)) break;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
  Cd(Lc() | 0, 1);
  return;
 }
 Cd(c[323] | 0, 1);
 return;
}

function ie() {
 var b = 0, e = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(c[323] | 0, 1);
  return;
 }
 if ((d[9385] | 0 | 0) != 1) {
  Ed(c[387] | 0, a[9385] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 if ((c[367] | 0) <= 0) {
  Cd(c[323] | 0, 1);
  return;
 }
 c[365] = c[(c[63] | 0) + (c[387] << 2) >> 2];
 c[366] = c[(c[63] | 0) + ((c[387] | 0) + 1 << 2) >> 2];
 c[368] = 0;
 c[364] = 0;
 c[370] = c[365];
 while (1) {
  if ((c[370] | 0) < (c[366] | 0)) b = (c[368] | 0) < (c[367] | 0); else b = 0;
  e = c[370] | 0;
  if (!b) break;
  c[370] = e + 1;
  if ((d[(c[64] | 0) + ((c[370] | 0) - 1) >> 0] | 0 | 0) != 123) {
   if ((d[(c[64] | 0) + ((c[370] | 0) - 1) >> 0] | 0 | 0) != 125) {
    c[368] = (c[368] | 0) + 1;
    continue;
   }
   if ((c[364] | 0) <= 0) continue;
   c[364] = (c[364] | 0) - 1;
   continue;
  }
  c[364] = (c[364] | 0) + 1;
  if ((c[364] | 0) != 1) continue;
  if ((c[370] | 0) >= (c[366] | 0)) continue;
  if ((d[(c[64] | 0) + (c[370] | 0) >> 0] | 0 | 0) != 92) continue;
  c[370] = (c[370] | 0) + 1;
  while (1) {
   if (!((c[370] | 0) < (c[366] | 0) ? (c[364] | 0) > 0 : 0)) break;
   if ((d[(c[64] | 0) + (c[370] | 0) >> 0] | 0 | 0) == 125) c[364] = (c[364] | 0) - 1; else if ((d[(c[64] | 0) + (c[370] | 0) >> 0] | 0 | 0) == 123) c[364] = (c[364] | 0) + 1;
   c[370] = (c[370] | 0) + 1;
  }
  c[368] = (c[368] | 0) + 1;
 }
 c[366] = e;
 while (1) {
  if (((c[259] | 0) + (c[364] | 0) + (c[366] | 0) - (c[365] | 0) | 0) <= (c[65] | 0)) break;
  Bb();
 }
 a : do if ((c[387] | 0) >= (c[386] | 0)) c[259] = c[366]; else while (1) {
  if ((c[365] | 0) >= (c[366] | 0)) break a;
  a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
  c[259] = (c[259] | 0) + 1;
  c[365] = (c[365] | 0) + 1;
 } while (0);
 while (1) {
  if ((c[364] | 0) <= 0) break;
  a[(c[64] | 0) + (c[259] | 0) >> 0] = 125;
  c[259] = (c[259] | 0) + 1;
  c[364] = (c[364] | 0) - 1;
 }
 Cd(Lc() | 0, 1);
 return;
}

function xj(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0.0;
 a : do if (b >>> 0 <= 20) do switch (b | 0) {
 case 9:
  {
   e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   b = c[e >> 2] | 0;
   c[d >> 2] = e + 4;
   c[a >> 2] = b;
   break a;
  }
 case 10:
  {
   e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   b = c[e >> 2] | 0;
   c[d >> 2] = e + 4;
   e = a;
   c[e >> 2] = b;
   c[e + 4 >> 2] = ((b | 0) < 0) << 31 >> 31;
   break a;
  }
 case 11:
  {
   e = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   b = c[e >> 2] | 0;
   c[d >> 2] = e + 4;
   e = a;
   c[e >> 2] = b;
   c[e + 4 >> 2] = 0;
   break a;
  }
 case 12:
  {
   e = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);
   b = e;
   f = c[b >> 2] | 0;
   b = c[b + 4 >> 2] | 0;
   c[d >> 2] = e + 8;
   e = a;
   c[e >> 2] = f;
   c[e + 4 >> 2] = b;
   break a;
  }
 case 13:
  {
   f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   e = c[f >> 2] | 0;
   c[d >> 2] = f + 4;
   e = (e & 65535) << 16 >> 16;
   f = a;
   c[f >> 2] = e;
   c[f + 4 >> 2] = ((e | 0) < 0) << 31 >> 31;
   break a;
  }
 case 14:
  {
   f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   e = c[f >> 2] | 0;
   c[d >> 2] = f + 4;
   f = a;
   c[f >> 2] = e & 65535;
   c[f + 4 >> 2] = 0;
   break a;
  }
 case 15:
  {
   f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   e = c[f >> 2] | 0;
   c[d >> 2] = f + 4;
   e = (e & 255) << 24 >> 24;
   f = a;
   c[f >> 2] = e;
   c[f + 4 >> 2] = ((e | 0) < 0) << 31 >> 31;
   break a;
  }
 case 16:
  {
   f = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
   e = c[f >> 2] | 0;
   c[d >> 2] = f + 4;
   f = a;
   c[f >> 2] = e & 255;
   c[f + 4 >> 2] = 0;
   break a;
  }
 case 17:
  {
   f = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);
   g = +h[f >> 3];
   c[d >> 2] = f + 8;
   h[a >> 3] = g;
   break a;
  }
 case 18:
  {
   f = (c[d >> 2] | 0) + (8 - 1) & ~(8 - 1);
   g = +h[f >> 3];
   c[d >> 2] = f + 8;
   h[a >> 3] = g;
   break a;
  }
 default:
  break a;
 } while (0); while (0);
 return;
}

function tg(a, b, d, e, f) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0;
 u = i;
 i = i + 80 | 0;
 g = u + 64 | 0;
 h = u + 60 | 0;
 j = u + 56 | 0;
 k = u + 52 | 0;
 o = u + 48 | 0;
 t = u + 40 | 0;
 l = u + 36 | 0;
 s = u + 32 | 0;
 v = u + 24 | 0;
 m = u + 16 | 0;
 n = u + 12 | 0;
 p = u + 8 | 0;
 q = u + 4 | 0;
 r = u;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[l >> 2] = 75;
 c[s >> 2] = kh(c[l >> 2] | 0) | 0;
 sg(v);
 c[t >> 2] = c[v >> 2];
 c[t + 4 >> 2] = c[v + 4 >> 2];
 c[o >> 2] = c[c[h >> 2] >> 2];
 a : while (1) {
  if (!(c[o >> 2] | 0)) {
   g = 15;
   break;
  }
  c[m >> 2] = c[c[o >> 2] >> 2];
  c[n >> 2] = si(c[m >> 2] | 0) | 0;
  c[p >> 2] = 0;
  while (1) {
   if (!(c[(c[j >> 2] | 0) + (c[p >> 2] << 2) >> 2] | 0)) break;
   c[q >> 2] = c[(c[j >> 2] | 0) + (c[p >> 2] << 2) >> 2];
   if (!(yf(c[g >> 2] | 0, c[q >> 2] | 0, 1) | 0)) {
    c[r >> 2] = si(c[q >> 2] | 0) | 0;
    while (1) {
     if (((c[n >> 2] | 0) + (c[r >> 2] | 0) + 1 | 0) >>> 0 <= (c[l >> 2] | 0) >>> 0) break;
     c[l >> 2] = (c[l >> 2] | 0) + (c[l >> 2] | 0);
     c[s >> 2] = mh(c[s >> 2] | 0, c[l >> 2] | 0) | 0;
    }
    zi(c[s >> 2] | 0, c[m >> 2] | 0) | 0;
    pi((c[s >> 2] | 0) + (c[n >> 2] | 0) | 0, c[q >> 2] | 0) | 0;
    if (Jg(c[g >> 2] | 0, c[s >> 2] | 0) | 0) {
     Lg(t, c[s >> 2] | 0);
     Tg(c[h >> 2] | 0, c[o >> 2] | 0);
     if (!(c[k >> 2] | 0)) {
      g = 11;
      break a;
     }
     c[l >> 2] = 75;
     c[s >> 2] = kh(c[l >> 2] | 0) | 0;
    }
   }
   c[p >> 2] = (c[p >> 2] | 0) + 1;
  }
  c[o >> 2] = c[(c[o >> 2] | 0) + 8 >> 2];
 }
 if ((g | 0) == 11) {
  c[a >> 2] = c[t >> 2];
  c[a + 4 >> 2] = c[t + 4 >> 2];
  i = u;
  return;
 } else if ((g | 0) == 15) {
  Cj(c[s >> 2] | 0);
  c[a >> 2] = c[t >> 2];
  c[a + 4 >> 2] = c[t + 4 >> 2];
  i = u;
  return;
 }
}

function Dg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0;
 o = i;
 i = i + 48 | 0;
 e = o + 32 | 0;
 p = o + 28 | 0;
 f = o + 24 | 0;
 j = o + 20 | 0;
 l = o + 16 | 0;
 g = o + 12 | 0;
 h = o + 8 | 0;
 k = o + 4 | 0;
 m = o;
 c[e >> 2] = b;
 c[p >> 2] = d;
 c[l >> 2] = 0;
 c[f >> 2] = ng(c[e >> 2] | 0, c[p >> 2] | 0) | 0;
 while (1) {
  if (!(c[f >> 2] | 0)) break;
  if (c[f >> 2] | 0) if (!(Ci(c[f >> 2] | 0, 34049) | 0)) {
   if (!(c[l >> 2] | 0)) c[l >> 2] = jh() | 0;
  } else n = 7; else n = 7;
  a : do if ((n | 0) == 7) {
   n = 0;
   if (c[f >> 2] | 0) if (!(Ci(c[f >> 2] | 0, 21586) | 0)) {
    if (!(c[l >> 2] | 0)) {
     c[g >> 2] = jh() | 0;
     c[l >> 2] = gh(c[g >> 2] | 0) | 0;
     Cj(c[g >> 2] | 0);
     break;
    }
    c[k >> 2] = c[l >> 2];
    c[h >> 2] = si(c[k >> 2] | 0) | 0;
    while (1) {
     if ((c[h >> 2] | 0) >>> 0 <= 0) break a;
     d = c[h >> 2] | 0;
     if ((a[(c[k >> 2] | 0) + ((c[h >> 2] | 0) - 1) >> 0] | 0) == 47) break;
     c[h >> 2] = d + -1;
    }
    a[(c[k >> 2] | 0) + (d >>> 0 > 1 ? (c[h >> 2] | 0) - 1 | 0 : 1) >> 0] = 0;
    break;
   }
   if (c[l >> 2] | 0) {
    c[m >> 2] = c[l >> 2];
    c[j >> 2] = si(c[l >> 2] | 0) | 0;
    c[l >> 2] = Ef(c[l >> 2] | 0, (a[(c[l >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] | 0) == 47 ? 28601 : 29173, c[f >> 2] | 0) | 0;
    Cj(c[m >> 2] | 0);
    break;
   } else {
    c[l >> 2] = Df(29173, c[f >> 2] | 0) | 0;
    break;
   }
  } while (0);
  c[f >> 2] = ng(c[e >> 2] | 0, 0) | 0;
 }
 if (!(c[l >> 2] | 0)) za(21589, 21374, 316, 21593);
 c[j >> 2] = si(c[l >> 2] | 0) | 0;
 if ((c[j >> 2] | 0) >>> 0 <= 0) {
  p = c[l >> 2] | 0;
  i = o;
  return p | 0;
 }
 if ((a[(c[l >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] | 0) != 47) {
  p = c[l >> 2] | 0;
  i = o;
  return p | 0;
 }
 a[(c[l >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] = 0;
 p = c[l >> 2] | 0;
 i = o;
 return p | 0;
}

function vg(a, b, d, e, f) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0, u = 0, v = 0;
 v = i;
 i = i + 96 | 0;
 t = v + 80 | 0;
 u = v + 16 | 0;
 g = v;
 q = v + 72 | 0;
 h = v + 68 | 0;
 r = v + 64 | 0;
 j = v + 60 | 0;
 k = v + 56 | 0;
 s = v + 48 | 0;
 o = v + 44 | 0;
 n = v + 40 | 0;
 l = v + 32 | 0;
 m = v + 24 | 0;
 c[q >> 2] = a;
 c[h >> 2] = b;
 c[r >> 2] = d;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[o >> 2] = Sf(c[q >> 2] | 0, c[r >> 2] | 0) | 0;
 c[n >> 2] = yf(c[q >> 2] | 0, c[o >> 2] | 0, 1) | 0;
 if (c[(c[q >> 2] | 0) + 44 >> 2] & 32) {
  Qi(29466, c[1840] | 0) | 0;
  b = c[1840] | 0;
  a = c[j >> 2] | 0;
  e = c[k >> 2] | 0;
  d = c[h >> 2] | 0;
  c[g >> 2] = c[o >> 2];
  c[g + 4 >> 2] = a;
  c[g + 8 >> 2] = e;
  c[g + 12 >> 2] = d;
  $i(b, 21147, g) | 0;
  ij(c[1840] | 0) | 0;
 }
 f = c[q >> 2] | 0;
 if (c[n >> 2] | 0) {
  wg(l, f, c[o >> 2] | 0);
  c[s >> 2] = c[l >> 2];
  c[s + 4 >> 2] = c[l + 4 >> 2];
 } else {
  xg(m, f, c[h >> 2] | 0, c[o >> 2] | 0, c[j >> 2] | 0, c[k >> 2] | 0);
  c[s >> 2] = c[m >> 2];
  c[s + 4 >> 2] = c[m + 4 >> 2];
 }
 if (!(c[s >> 2] | 0)) p = 9; else if (c[k >> 2] | 0) if (c[(c[s + 4 >> 2] | 0) + ((c[s >> 2] | 0) - 1 << 2) >> 2] | 0) p = 9;
 if ((p | 0) == 9) Lg(s, 0);
 f = c[q >> 2] | 0;
 if (!(c[(c[q >> 2] | 0) + 92 >> 2] | 0)) {
  c[f + 92 >> 2] = 1;
  u = s + 4 | 0;
  u = c[u >> 2] | 0;
  i = v;
  return u | 0;
 }
 if (c[f + 44 >> 2] & 32) {
  Qi(29466, c[1840] | 0) | 0;
  p = c[1840] | 0;
  c[u >> 2] = c[r >> 2];
  $i(p, 21208, u) | 0;
  ij(c[1840] | 0) | 0;
 }
 u = c[q >> 2] | 0;
 c[t >> 2] = c[s >> 2];
 c[t + 4 >> 2] = c[s + 4 >> 2];
 ug(u, t);
 if (!(c[(c[q >> 2] | 0) + 44 >> 2] & 32)) {
  u = s + 4 | 0;
  u = c[u >> 2] | 0;
  i = v;
  return u | 0;
 }
 Vi(10, c[1840] | 0) | 0;
 u = s + 4 | 0;
 u = c[u >> 2] | 0;
 i = v;
 return u | 0;
}

function Zg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 32 | 0;
 g = n + 24 | 0;
 j = n + 20 | 0;
 k = n + 16 | 0;
 l = n + 12 | 0;
 h = n + 8 | 0;
 e = n + 4 | 0;
 f = n;
 c[n + 28 >> 2] = b;
 c[g >> 2] = d;
 if (!(c[g >> 2] | 0)) za(28516, 28521, 53, 28576);
 if ((a[c[g >> 2] >> 0] | 0) == 33) if ((a[(c[g >> 2] | 0) + 1 >> 0] | 0) == 33) {
  c[g >> 2] = (c[g >> 2] | 0) + 2;
  c[l >> 2] = 28598;
 } else m = 6; else m = 6;
 if ((m | 0) == 6) c[l >> 2] = 28601;
 if ((a[c[g >> 2] >> 0] | 0) != 126) {
  if (a[c[l >> 2] >> 0] | 0) c[g >> 2] = (c[g >> 2] | 0) + -2;
  c[j >> 2] = c[g >> 2];
  m = c[j >> 2] | 0;
  i = n;
  return m | 0;
 }
 if (a[(c[g >> 2] | 0) + 1 >> 0] | 0) if ((a[(c[g >> 2] | 0) + 1 >> 0] | 0) == 47) m = 21; else {
  c[h >> 2] = 2;
  while (1) {
   if ((a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] | 0) == 47) b = 0; else b = (a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] | 0) != 0;
   d = c[h >> 2] | 0;
   if (!b) break;
   c[h >> 2] = d + 1;
  }
  c[f >> 2] = kh(d) | 0;
  Ai(c[f >> 2] | 0, (c[g >> 2] | 0) + 1 | 0, (c[h >> 2] | 0) - 1 | 0) | 0;
  a[(c[f >> 2] | 0) + ((c[h >> 2] | 0) - 1) >> 0] = 0;
  c[e >> 2] = Qa(c[f >> 2] | 0) | 0;
  Cj(c[f >> 2] | 0);
  if (c[e >> 2] | 0) b = c[(c[e >> 2] | 0) + 20 >> 2] | 0; else b = 34049;
  c[k >> 2] = b;
 } else m = 21;
 if ((m | 0) == 21) {
  c[h >> 2] = 1;
  m = Ka(28602) | 0;
  c[k >> 2] = m;
  c[k >> 2] = (c[k >> 2] | 0) != 0 ? m : 34049;
 }
 if ((a[c[k >> 2] >> 0] | 0) == 47) if ((a[(c[k >> 2] | 0) + 1 >> 0] | 0) == 47) c[k >> 2] = (c[k >> 2] | 0) + 1;
 if (a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] | 0) {
  m = (si(c[k >> 2] | 0) | 0) - 1 | 0;
  if ((a[(c[k >> 2] | 0) + m >> 0] | 0) == 47) c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 c[j >> 2] = Ef(c[l >> 2] | 0, c[k >> 2] | 0, (c[g >> 2] | 0) + (c[h >> 2] | 0) | 0) | 0;
 m = c[j >> 2] | 0;
 i = n;
 return m | 0;
}

function Vf(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0;
 q = i;
 i = i + 80 | 0;
 o = q + 16 | 0;
 n = q;
 f = q + 64 | 0;
 g = q + 60 | 0;
 e = q + 56 | 0;
 k = q + 52 | 0;
 h = q + 48 | 0;
 j = q + 44 | 0;
 m = q + 40 | 0;
 l = q + 36 | 0;
 c[g >> 2] = b;
 c[e >> 2] = d;
 c[j >> 2] = Ka(20543) | 0;
 if (!(c[j >> 2] | 0)) {
  c[f >> 2] = c[e >> 2];
  p = c[f >> 2] | 0;
  i = q;
  return p | 0;
 }
 c[k >> 2] = kh(1) | 0;
 a[c[k >> 2] >> 0] = 0;
 c[h >> 2] = mg(c[g >> 2] | 0, c[e >> 2] | 0) | 0;
 while (1) {
  e = c[k >> 2] | 0;
  if (!(c[h >> 2] | 0)) break;
  c[m >> 2] = e;
  c[l >> 2] = 1;
  do if (yf(c[g >> 2] | 0, c[h >> 2] | 0, 0) | 0) p = 8; else {
   if ((a[c[h >> 2] >> 0] | 0) == 33) if ((a[(c[h >> 2] | 0) + 1 >> 0] | 0) == 33) {
    p = 8;
    break;
   }
   if ((a[c[h >> 2] >> 0] | 0) == 46) if (!(a[(c[h >> 2] | 0) + 1 >> 0] | 0)) {
    c[k >> 2] = Ef(c[k >> 2] | 0, c[j >> 2] | 0, 20541) | 0;
    break;
   }
   if ((a[c[h >> 2] >> 0] | 0) == 46) if ((a[(c[h >> 2] | 0) + 1 >> 0] | 0) == 47) {
    d = c[k >> 2] | 0;
    b = (c[h >> 2] | 0) + 1 | 0;
    c[n >> 2] = c[j >> 2];
    c[n + 4 >> 2] = b;
    c[n + 8 >> 2] = 20541;
    c[n + 12 >> 2] = 0;
    c[k >> 2] = Ff(d, n) | 0;
    break;
   }
   if (a[c[h >> 2] >> 0] | 0) {
    d = c[k >> 2] | 0;
    b = c[h >> 2] | 0;
    c[o >> 2] = c[j >> 2];
    c[o + 4 >> 2] = 29173;
    c[o + 8 >> 2] = b;
    c[o + 12 >> 2] = 20541;
    c[o + 16 >> 2] = 0;
    c[k >> 2] = Ff(d, o) | 0;
    break;
   } else {
    c[l >> 2] = 0;
    break;
   }
  } while (0);
  if ((p | 0) == 8) {
   p = 0;
   c[k >> 2] = Ef(c[k >> 2] | 0, c[h >> 2] | 0, 20541) | 0;
  }
  if (c[l >> 2] | 0) Cj(c[m >> 2] | 0);
  c[h >> 2] = mg(c[g >> 2] | 0, 0) | 0;
 }
 p = (si(e) | 0) - 1 | 0;
 a[(c[k >> 2] | 0) + p >> 0] = 0;
 c[f >> 2] = c[k >> 2];
 p = c[f >> 2] | 0;
 i = q;
 return p | 0;
}

function og(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 o = i;
 i = i + 32 | 0;
 g = o + 28 | 0;
 h = o + 24 | 0;
 f = o + 20 | 0;
 j = o + 16 | 0;
 m = o + 12 | 0;
 n = o + 8 | 0;
 k = o + 4 | 0;
 l = o;
 c[h >> 2] = b;
 c[f >> 2] = d;
 c[j >> 2] = e;
 if (c[f >> 2] | 0) c[(c[h >> 2] | 0) + 88 >> 2] = c[f >> 2]; else if (!(c[(c[h >> 2] | 0) + 88 >> 2] | 0)) {
  c[g >> 2] = 0;
  n = c[g >> 2] | 0;
  i = o;
  return n | 0;
 }
 if (!(c[(c[h >> 2] | 0) + 88 >> 2] | 0)) za(20988, 20999, 49, 21057);
 c[m >> 2] = c[(c[h >> 2] | 0) + 88 >> 2];
 c[k >> 2] = 0;
 while (1) {
  if (a[c[m >> 2] >> 0] | 0) {
   if (!(c[k >> 2] | 0)) {
    f = a[c[m >> 2] >> 0] | 0;
    f = (((c[j >> 2] | 0) != 0 ? (f | 0) == 58 : (f | 0) == 47) & 1 | 0) != 0;
   } else f = 0;
   f = f ^ 1;
  } else f = 0;
  e = c[m >> 2] | 0;
  if (!f) break;
  if ((a[e >> 0] | 0) == 123) c[k >> 2] = (c[k >> 2] | 0) + 1; else if ((a[c[m >> 2] >> 0] | 0) == 125) c[k >> 2] = (c[k >> 2] | 0) + -1;
  c[m >> 2] = (c[m >> 2] | 0) + 1;
 }
 c[l >> 2] = e - (c[(c[h >> 2] | 0) + 88 >> 2] | 0);
 if (((c[l >> 2] | 0) + 1 | 0) >>> 0 > (c[(c[h >> 2] | 0) + 84 >> 2] | 0) >>> 0) {
  c[(c[h >> 2] | 0) + 84 >> 2] = (c[l >> 2] | 0) + 1;
  m = mh(c[(c[h >> 2] | 0) + 80 >> 2] | 0, c[(c[h >> 2] | 0) + 84 >> 2] | 0) | 0;
  c[(c[h >> 2] | 0) + 80 >> 2] = m;
 }
 Ai(c[(c[h >> 2] | 0) + 80 >> 2] | 0, c[(c[h >> 2] | 0) + 88 >> 2] | 0, c[l >> 2] | 0) | 0;
 a[(c[(c[h >> 2] | 0) + 80 >> 2] | 0) + (c[l >> 2] | 0) >> 0] = 0;
 c[n >> 2] = c[(c[h >> 2] | 0) + 80 >> 2];
 if (!(a[(c[(c[h >> 2] | 0) + 88 >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0)) c[(c[h >> 2] | 0) + 88 >> 2] = 0; else {
  m = (c[h >> 2] | 0) + 88 | 0;
  c[m >> 2] = (c[m >> 2] | 0) + ((c[l >> 2] | 0) + 1);
 }
 c[g >> 2] = c[n >> 2];
 n = c[g >> 2] | 0;
 i = o;
 return n | 0;
}

function oe() {
 var b = 0, e = 0;
 pe();
 c[70] = kh((si(Re(c[1780] | 0) | 0) | 0) + 5 + 1 | 0) | 0;
 e = (c[70] | 0) + 1 | 0;
 zi(e, Re(c[1780] | 0) | 0) | 0;
 c[69] = si((c[70] | 0) + 1 | 0) | 0;
 if (((c[69] | 0) + ((c[(c[63] | 0) + ((c[281] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[281] << 2) >> 2] | 0)) | 0) <= 2147483647) if (((c[69] | 0) + ((c[(c[63] | 0) + ((c[283] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[283] << 2) >> 2] | 0)) | 0) <= 2147483647) if (((c[69] | 0) + ((c[(c[63] | 0) + ((c[282] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[282] << 2) >> 2] | 0)) | 0) <= 2147483647) {
  c[71] = c[69];
  if ((c[71] | 0) < 4) b = 7; else if (Ci((c[70] | 0) + 1 + (c[71] | 0) + -4 | 0, 18040) | 0) b = 7; else c[69] = (c[69] | 0) - 4;
  if ((b | 0) == 7) Kc(c[281] | 0);
  c[72] = 0;
  if (mf((c[70] | 0) + 1 | 0) | 0) if (Ue(2664 + (c[72] << 2) | 0, -1, 13669) | 0) {
   c[71] = c[69];
   Kc(c[283] | 0);
   if (nf((c[70] | 0) + 1 | 0) | 0) if (Ve(44, 16058) | 0) {
    c[71] = c[69];
    Kc(c[282] | 0);
    if (nf((c[70] | 0) + 1 | 0) | 0) if (Ve(708, 16058) | 0) {
     c[71] = c[69];
     Kc(c[281] | 0);
     c[68] = 1;
     while (1) {
      if ((c[68] | 0) > (c[71] | 0)) break;
      a[(c[15] | 0) + (c[68] | 0) >> 0] = a[8357 + (d[(c[70] | 0) + (c[68] | 0) >> 0] | 0) >> 0] | 0;
      c[68] = (c[68] | 0) + 1;
     }
     e = Qc(c[15] | 0, 1, c[69] | 0, 0, 1) | 0;
     c[687] = c[(c[167] | 0) + (e << 2) >> 2];
     e = Qc(c[15] | 0, 1, c[71] | 0, 3, 1) | 0;
     c[292 + (c[72] << 2) >> 2] = c[(c[167] | 0) + (e << 2) >> 2];
     if (c[263] | 0) {
      Qi(13672, c[11] | 0) | 0;
      Qi(13672, c[12] | 0) | 0;
      wb();
      xa(96, 1);
     } else {
      c[376 + (c[72] << 2) >> 2] = 0;
      return;
     }
    }
    Hb();
    $e(1);
   }
   Hb();
   $e(1);
  }
  Hb();
  $e(1);
 }
 Gb();
 $e(1);
}

function lh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0;
 p = i;
 i = i + 48 | 0;
 n = p + 8 | 0;
 m = p;
 e = p + 40 | 0;
 f = p + 36 | 0;
 q = p + 32 | 0;
 g = p + 28 | 0;
 k = p + 24 | 0;
 j = p + 20 | 0;
 l = p + 16 | 0;
 h = p + 12 | 0;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[q >> 2] = d;
 c[k >> 2] = 0;
 c[g >> 2] = Ef(c[f >> 2] | 0, 29056, c[q >> 2] | 0) | 0;
 c[l >> 2] = (si(c[f >> 2] | 0) | 0) + 1;
 c[h >> 2] = 0;
 while (1) {
  if ((c[h >> 2] | 0) == (c[(c[e >> 2] | 0) + 4164 >> 2] | 0)) break;
  if (!(qi(c[(c[(c[e >> 2] | 0) + 4160 >> 2] | 0) + (c[h >> 2] << 2) >> 2] | 0, c[g >> 2] | 0, c[l >> 2] | 0) | 0)) {
   o = 4;
   break;
  }
  c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 if ((o | 0) == 4) c[k >> 2] = Ka(c[f >> 2] | 0) | 0;
 if (c[k >> 2] | 0) if (!(Ci(c[k >> 2] | 0, (c[g >> 2] | 0) + (c[l >> 2] | 0) | 0) | 0)) {
  Cj(c[g >> 2] | 0);
  i = p;
  return;
 }
 if ((la(c[g >> 2] | 0) | 0) < 0) {
  q = c[1840] | 0;
  c[m >> 2] = c[(c[e >> 2] | 0) + 104 >> 2];
  $i(q, 29435, m) | 0;
  q = c[1840] | 0;
  c[n >> 2] = c[g >> 2];
  $i(q, 29058, n) | 0;
  Qi(29463, c[1840] | 0) | 0;
  _a(1);
 }
 c[j >> 2] = Ka(c[f >> 2] | 0) | 0;
 if ((c[j >> 2] | 0) != ((c[g >> 2] | 0) + (c[l >> 2] | 0) | 0)) {
  Cj(c[g >> 2] | 0);
  i = p;
  return;
 }
 if ((c[h >> 2] | 0) == (c[(c[e >> 2] | 0) + 4164 >> 2] | 0)) {
  q = (c[e >> 2] | 0) + 4164 | 0;
  c[q >> 2] = (c[q >> 2] | 0) + 1;
  q = mh(c[(c[e >> 2] | 0) + 4160 >> 2] | 0, c[(c[e >> 2] | 0) + 4164 >> 2] << 2) | 0;
  c[(c[e >> 2] | 0) + 4160 >> 2] = q;
 } else Cj(c[(c[(c[e >> 2] | 0) + 4160 >> 2] | 0) + (c[h >> 2] << 2) >> 2] | 0);
 c[(c[(c[e >> 2] | 0) + 4160 >> 2] | 0) + (c[h >> 2] << 2) >> 2] = c[g >> 2];
 i = p;
 return;
}

function Eb() {
 var a = 0, b = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 g = h + 8 | 0;
 f = h;
 e = h + 12 | 0;
 Qi(9628, c[11] | 0) | 0;
 Qi(9628, c[12] | 0) | 0;
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) >= (c[67] | 0)) break;
  if ((d[8613 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
   Vi(d[8901] | 0, c[11] | 0) | 0;
   Vi(d[8901] | 0, c[12] | 0) | 0;
  } else {
   Vi(d[8869 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0, c[11] | 0) | 0;
   Vi(d[8869 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0, c[12] | 0) | 0;
  }
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 rb();
 Qi(9628, c[11] | 0) | 0;
 Qi(9628, c[12] | 0) | 0;
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) >= (c[67] | 0)) break;
  Vi(d[8901] | 0, c[11] | 0) | 0;
  Vi(d[8901] | 0, c[12] | 0) | 0;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 c[e >> 2] = c[67];
 while (1) {
  if ((c[e >> 2] | 0) >= (c[21] | 0)) break;
  if ((d[8613 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
   Vi(d[8901] | 0, c[11] | 0) | 0;
   Vi(d[8901] | 0, c[12] | 0) | 0;
  } else {
   Vi(d[8869 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0, c[11] | 0) | 0;
   Vi(d[8869 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0, c[12] | 0) | 0;
  }
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 rb();
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) < (c[67] | 0)) b = (d[8613 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1; else b = 0;
  a = c[e >> 2] | 0;
  if (!b) break;
  c[e >> 2] = a + 1;
 }
 if ((a | 0) != (c[67] | 0)) {
  tb();
  i = h;
  return;
 }
 e = c[11] | 0;
 c[f >> 2] = 9632;
 $i(e, 16602, f) | 0;
 f = c[12] | 0;
 c[g >> 2] = 9632;
 $i(f, 16602, g) | 0;
 tb();
 i = h;
 return;
}

function vd(a) {
 a = a | 0;
 var b = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 b = e;
 c[b >> 2] = a;
 c[352] = 0;
 c[353] = 0;
 c[354] = 0;
 a : while (1) {
  if (c[354] | 0) {
   a = 27;
   break;
  }
  if ((c[273] | 0) >= (c[355] | 0)) {
   a = 27;
   break;
  }
  switch (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) {
  case 65:
  case 97:
   {
    c[273] = (c[273] | 0) + 1;
    do if (c[353] | 0) if ((c[273] | 0) <= ((c[355] | 0) - 3 | 0)) {
     if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) != 110) if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) != 78) break;
     if ((d[(c[17] | 0) + ((c[273] | 0) + 1) >> 0] | 0 | 0) != 100) if ((d[(c[17] | 0) + ((c[273] | 0) + 1) >> 0] | 0 | 0) != 68) break;
     if ((d[8613 + (d[(c[17] | 0) + ((c[273] | 0) + 2) >> 0] | 0) >> 0] | 0 | 0) == 1) {
      c[273] = (c[273] | 0) + 2;
      c[354] = 1;
     }
    } while (0);
    c[353] = 0;
    continue a;
   }
  case 123:
   {
    c[352] = (c[352] | 0) + 1;
    c[273] = (c[273] | 0) + 1;
    while (1) {
     if ((c[352] | 0) <= 0) break;
     if ((c[273] | 0) >= (c[355] | 0)) break;
     if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; else if ((d[(c[17] | 0) + (c[273] | 0) >> 0] | 0 | 0) == 123) c[352] = (c[352] | 0) + 1;
     c[273] = (c[273] | 0) + 1;
    }
    c[353] = 0;
    continue a;
   }
  case 125:
   {
    td(c[b >> 2] | 0);
    c[273] = (c[273] | 0) + 1;
    c[353] = 0;
    continue a;
   }
  default:
   {
    a = (d[8613 + (d[(c[17] | 0) + (c[273] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1;
    c[273] = (c[273] | 0) + 1;
    if (a) {
     c[353] = 1;
     continue a;
    } else {
     c[353] = 0;
     continue a;
    }
   }
  }
 }
 if ((a | 0) == 27) {
  ud(c[b >> 2] | 0);
  i = e;
  return;
 }
}

function ch(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 q = i;
 i = i + 48 | 0;
 n = q;
 g = q + 40 | 0;
 h = q + 36 | 0;
 s = q + 32 | 0;
 t = q + 28 | 0;
 j = q + 24 | 0;
 l = q + 20 | 0;
 r = q + 16 | 0;
 m = q + 12 | 0;
 o = q + 8 | 0;
 k = q + 4 | 0;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[s >> 2] = e;
 c[t >> 2] = f;
 c[j >> 2] = 0;
 c[r >> 2] = (c[t >> 2] | 0) - (c[s >> 2] | 0) + 1;
 c[m >> 2] = kh((c[r >> 2] | 0) + 1 | 0) | 0;
 Ai(c[m >> 2] | 0, c[s >> 2] | 0, c[r >> 2] | 0) | 0;
 a[(c[m >> 2] | 0) + (c[r >> 2] | 0) >> 0] = 0;
 if (dh(c[g >> 2] | 0, c[m >> 2] | 0) | 0) {
  Qi(28730, c[1840] | 0) | 0;
  t = c[1840] | 0;
  c[n >> 2] = c[m >> 2];
  $i(t, 28827, n) | 0;
  Qi(29463, c[1840] | 0) | 0;
  ij(c[1840] | 0) | 0;
  t = c[m >> 2] | 0;
  Cj(t);
  t = c[j >> 2] | 0;
  i = q;
  return t | 0;
 }
 c[o >> 2] = Ef(c[m >> 2] | 0, 28703, c[(c[g >> 2] | 0) + 112 >> 2] | 0) | 0;
 c[l >> 2] = Ka(c[o >> 2] | 0) | 0;
 Cj(c[o >> 2] | 0);
 if (c[l >> 2] | 0) {
  if (!(a[c[l >> 2] >> 0] | 0)) p = 5;
 } else p = 5;
 if ((p | 0) == 5) c[l >> 2] = Ka(c[m >> 2] | 0) | 0;
 if (c[l >> 2] | 0) {
  if (!(a[c[l >> 2] >> 0] | 0)) p = 8;
 } else p = 8;
 if ((p | 0) == 8) c[l >> 2] = Af(c[g >> 2] | 0, c[m >> 2] | 0) | 0;
 if (!(c[l >> 2] | 0)) {
  t = c[m >> 2] | 0;
  Cj(t);
  t = c[j >> 2] | 0;
  i = q;
  return t | 0;
 }
 c[j >> 2] = 1;
 eh(c[g >> 2] | 0, c[m >> 2] | 0, 1);
 c[k >> 2] = Sf(c[g >> 2] | 0, c[l >> 2] | 0) | 0;
 eh(c[g >> 2] | 0, c[m >> 2] | 0, 0);
 s = c[h >> 2] | 0;
 t = c[k >> 2] | 0;
 Ch(s, t, si(c[k >> 2] | 0) | 0);
 Cj(c[k >> 2] | 0);
 t = c[m >> 2] | 0;
 Cj(t);
 t = c[j >> 2] | 0;
 i = q;
 return t | 0;
}

function rf(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0;
 q = i;
 i = i + 48 | 0;
 g = q + 44 | 0;
 h = q + 40 | 0;
 j = q + 36 | 0;
 n = q + 32 | 0;
 o = q + 28 | 0;
 k = q + 24 | 0;
 p = q + 20 | 0;
 m = q + 16 | 0;
 l = q;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[n >> 2] = (c[g >> 2] | 0) + 132 + ((c[h >> 2] | 0) * 68 | 0);
 if (c[(c[n >> 2] | 0) + 44 >> 2] | 0) e = c[(c[n >> 2] | 0) + 44 >> 2] | 0; else e = c[j >> 2] | 0;
 c[o >> 2] = e;
 c[k >> 2] = _g(c[o >> 2] | 0) | 0;
 c[p >> 2] = $g(c[g >> 2] | 0, c[k >> 2] | 0) | 0;
 c[(c[n >> 2] | 0) + 44 >> 2] = c[o >> 2];
 c[(c[n >> 2] | 0) + 48 >> 2] = 0;
 b = kh(8) | 0;
 c[(c[n >> 2] | 0) + 52 >> 2] = b;
 j = c[j >> 2] | 0;
 b = (c[n >> 2] | 0) + 48 | 0;
 o = c[b >> 2] | 0;
 c[b >> 2] = o + 1;
 c[(c[(c[n >> 2] | 0) + 52 >> 2] | 0) + (o << 2) >> 2] = j;
 c[l >> 2] = f;
 while (1) {
  o = (c[l >> 2] | 0) + (4 - 1) & ~(4 - 1);
  f = c[o >> 2] | 0;
  c[l >> 2] = o + 4;
  c[m >> 2] = f;
  if (!f) break;
  f = (c[n >> 2] | 0) + 48 | 0;
  c[f >> 2] = (c[f >> 2] | 0) + 1;
  f = mh(c[(c[n >> 2] | 0) + 52 >> 2] | 0, (c[(c[n >> 2] | 0) + 48 >> 2] | 0) + 1 << 2) | 0;
  c[(c[n >> 2] | 0) + 52 >> 2] = f;
  c[(c[(c[n >> 2] | 0) + 52 >> 2] | 0) + ((c[(c[n >> 2] | 0) + 48 >> 2] | 0) - 1 << 2) >> 2] = c[m >> 2];
 }
 c[(c[(c[n >> 2] | 0) + 52 >> 2] | 0) + (c[(c[n >> 2] | 0) + 48 >> 2] << 2) >> 2] = 0;
 if (!(c[p >> 2] | 0)) {
  f = c[k >> 2] | 0;
  Cj(f);
  i = q;
  return;
 }
 if (!(a[c[p >> 2] >> 0] | 0)) {
  f = c[k >> 2] | 0;
  Cj(f);
  i = q;
  return;
 }
 cf(c[g >> 2] | 0, c[h >> 2] | 0, (a[c[p >> 2] >> 0] | 0) == 49 & 1, 3);
 f = c[k >> 2] | 0;
 Cj(f);
 i = q;
 return;
}

function pe() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 112 | 0;
 e = f;
 b = f + 24 | 0;
 a = f + 16 | 0;
 d = f + 12 | 0;
 g = f + 8 | 0;
 c[691] = 1;
 c[711] = 2;
 c[g >> 2] = 0;
 c[b >> 2] = 13707;
 c[b + 4 >> 2] = 0;
 c[b + 8 >> 2] = 2764;
 c[b + 12 >> 2] = 0;
 c[g >> 2] = (c[g >> 2] | 0) + 1;
 c[b + (c[g >> 2] << 4) >> 2] = 13713;
 c[b + (c[g >> 2] << 4) + 4 >> 2] = 1;
 c[b + (c[g >> 2] << 4) + 8 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 12 >> 2] = 0;
 c[g >> 2] = (c[g >> 2] | 0) + 1;
 c[b + (c[g >> 2] << 4) >> 2] = 13727;
 c[b + (c[g >> 2] << 4) + 4 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 8 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 12 >> 2] = 0;
 c[g >> 2] = (c[g >> 2] | 0) + 1;
 c[b + (c[g >> 2] << 4) >> 2] = 13732;
 c[b + (c[g >> 2] << 4) + 4 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 8 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 12 >> 2] = 0;
 c[g >> 2] = (c[g >> 2] | 0) + 1;
 c[b + (c[g >> 2] << 4) >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 4 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 8 >> 2] = 0;
 c[b + (c[g >> 2] << 4) + 12 >> 2] = 0;
 do {
  c[a >> 2] = Nh(c[720] | 0, c[721] | 0, 28601, b, d) | 0;
  do if ((c[a >> 2] | 0) != -1) {
   if ((c[a >> 2] | 0) == 63) {
    af(13740);
    break;
   }
   if (!(Ci(c[b + (c[d >> 2] << 4) >> 2] | 0, 13713) | 0)) {
    c[711] = oi(c[1785] | 0) | 0;
    break;
   }
   if (!(Ci(c[b + (c[d >> 2] << 4) >> 2] | 0, 13727) | 0)) {
    bf(8, 0);
    break;
   }
   if (!(Ci(c[b + (c[d >> 2] << 4) >> 2] | 0, 13732) | 0)) Ze(13747, 13777, 0, 0);
  } while (0);
 } while ((c[a >> 2] | 0) == -1 ^ 1);
 if (((c[1780] | 0) + 1 | 0) == (c[720] | 0)) {
  i = f;
  return;
 }
 g = c[1840] | 0;
 c[e >> 2] = 13740;
 c[e + 4 >> 2] = 13798;
 $i(g, 13792, e) | 0;
 af(13740);
 i = f;
 return;
}

function Yg(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 m = i;
 i = i + 32 | 0;
 j = m;
 k = m + 20 | 0;
 n = m + 16 | 0;
 g = m + 12 | 0;
 l = m + 8 | 0;
 h = m + 4 | 0;
 c[k >> 2] = b;
 c[n >> 2] = d;
 c[g >> 2] = e;
 if ((c[n >> 2] | 0) != 0 & (c[n >> 2] | 0) != 1 & (c[n >> 2] | 0) != 2 & (c[n >> 2] | 0) != 3 & (c[n >> 2] | 0) != 33) {
  i = m;
  return;
 }
 if (!(c[(c[k >> 2] | 0) + 4148 >> 2] | 0)) if (!(c[(c[k >> 2] | 0) + 4144 >> 2] | 0)) {
  c[h >> 2] = $g(c[k >> 2] | 0, 28209) | 0;
  do if (c[h >> 2] | 0) {
   if ((a[c[h >> 2] >> 0] | 0) == 49) f = 6; else if (c[h >> 2] | 0) {
    if (a[c[h >> 2] >> 0] | 0) if ((a[c[h >> 2] >> 0] | 0) != 48) break;
    c[h >> 2] = 0;
   }
  } else f = 6; while (0);
  if ((f | 0) == 6) c[h >> 2] = 28222;
  if (c[h >> 2] | 0) e = Qf(c[h >> 2] | 0, 28235) | 0; else e = 0;
  c[(c[k >> 2] | 0) + 4148 >> 2] = e;
  if (!(c[(c[k >> 2] | 0) + 4148 >> 2] | 0)) if ($g(c[k >> 2] | 0, 28238) | 0) {
   n = $g(c[k >> 2] | 0, 28238) | 0;
   c[h >> 2] = Ef(n, 29173, c[h >> 2] | 0) | 0;
   n = Qf(c[h >> 2] | 0, 28235) | 0;
   c[(c[k >> 2] | 0) + 4148 >> 2] = n;
  }
  if (c[(c[k >> 2] | 0) + 4148 >> 2] | 0) {
   n = c[1840] | 0;
   c[j >> 2] = c[h >> 2];
   $i(n, 28250, j) | 0;
  }
 }
 if (!(c[(c[k >> 2] | 0) + 4148 >> 2] | 0)) {
  i = m;
  return;
 }
 Qi(c[c[g >> 2] >> 2] | 0, c[(c[k >> 2] | 0) + 4148 >> 2] | 0) | 0;
 c[l >> 2] = (c[g >> 2] | 0) + 4;
 while (1) {
  e = c[(c[k >> 2] | 0) + 4148 >> 2] | 0;
  if (!(c[c[l >> 2] >> 2] | 0)) break;
  Vi(32, e) | 0;
  Qi(c[c[l >> 2] >> 2] | 0, c[(c[k >> 2] | 0) + 4148 >> 2] | 0) | 0;
  c[l >> 2] = (c[l >> 2] | 0) + 4;
 }
 Vi(10, e) | 0;
 i = m;
 return;
}

function Wc(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 o = i;
 i = i + 32 | 0;
 l = o + 20 | 0;
 m = o + 16 | 0;
 n = o + 12 | 0;
 h = o + 8 | 0;
 j = o + 4 | 0;
 k = o;
 f = o + 25 | 0;
 g = o + 24 | 0;
 c[l >> 2] = b;
 c[m >> 2] = e;
 e = _(c[l >> 2] | 0, c[277] | 0) | 0;
 c[j >> 2] = e + (c[278] | 0);
 e = _(c[m >> 2] | 0, c[277] | 0) | 0;
 c[k >> 2] = e + (c[278] | 0);
 c[h >> 2] = 0;
 while (1) {
  e = _(c[j >> 2] | 0, (c[279] | 0) + 1 | 0) | 0;
  a[f >> 0] = a[(c[280] | 0) + (e + (c[h >> 2] | 0)) >> 0] | 0;
  e = _(c[k >> 2] | 0, (c[279] | 0) + 1 | 0) | 0;
  a[g >> 0] = a[(c[280] | 0) + (e + (c[h >> 2] | 0)) >> 0] | 0;
  e = (d[g >> 0] | 0 | 0) == 127;
  if ((d[f >> 0] | 0 | 0) == 127) {
   b = 3;
   break;
  }
  if (e) {
   b = 11;
   break;
  }
  if ((d[f >> 0] | 0 | 0) < (d[g >> 0] | 0 | 0)) {
   b = 13;
   break;
  }
  if ((d[f >> 0] | 0 | 0) > (d[g >> 0] | 0 | 0)) {
   b = 15;
   break;
  }
  c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 if ((b | 0) == 3) {
  if (!e) {
   c[n >> 2] = 1;
   n = c[n >> 2] | 0;
   i = o;
   return n | 0;
  }
  if ((c[l >> 2] | 0) < (c[m >> 2] | 0)) {
   c[n >> 2] = 1;
   n = c[n >> 2] | 0;
   i = o;
   return n | 0;
  }
  if ((c[l >> 2] | 0) <= (c[m >> 2] | 0)) {
   Qi(11411, c[11] | 0) | 0;
   Qi(11411, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
  c[n >> 2] = 0;
  n = c[n >> 2] | 0;
  i = o;
  return n | 0;
 } else if ((b | 0) == 11) {
  c[n >> 2] = 0;
  n = c[n >> 2] | 0;
  i = o;
  return n | 0;
 } else if ((b | 0) == 13) {
  c[n >> 2] = 1;
  n = c[n >> 2] | 0;
  i = o;
  return n | 0;
 } else if ((b | 0) == 15) {
  c[n >> 2] = 0;
  n = c[n >> 2] | 0;
  i = o;
  return n | 0;
 }
 return 0;
}

function Of(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 16 | 0;
 h = k + 12 | 0;
 f = k + 8 | 0;
 g = k + 4 | 0;
 j = k;
 c[h >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = c[h >> 2];
 c[j >> 2] = 0;
 while (1) {
  if (!(a[c[h >> 2] >> 0] | 0)) break;
  if (!(a[c[f >> 2] >> 0] | 0)) break;
  if ((a[c[h >> 2] >> 0] | 0) != (a[c[f >> 2] >> 0] | 0)) {
   e = 5;
   break;
  }
  c[h >> 2] = (c[h >> 2] | 0) + 1;
  c[f >> 2] = (c[f >> 2] | 0) + 1;
 }
 a : do if ((e | 0) == 5) if ((a[c[f >> 2] >> 0] | 0) == 47) if ((c[g >> 2] | 0) >>> 0 < (c[h >> 2] | 0) >>> 0) if ((a[(c[f >> 2] | 0) + -1 >> 0] | 0) == 47) {
  while (1) {
   b = c[f >> 2] | 0;
   if ((a[c[f >> 2] >> 0] | 0) != 47) break;
   c[f >> 2] = b + 1;
  }
  if (!(a[b >> 0] | 0)) {
   c[j >> 2] = 1;
   break;
  }
  while (1) {
   if (c[j >> 2] | 0) break a;
   if (!(a[c[h >> 2] >> 0] | 0)) break a;
   if ((a[(c[h >> 2] | 0) + -1 >> 0] | 0) == 47) if ((a[c[h >> 2] >> 0] | 0) == (a[c[f >> 2] >> 0] | 0)) c[j >> 2] = Of(c[h >> 2] | 0, c[f >> 2] | 0) | 0;
   c[h >> 2] = (c[h >> 2] | 0) + 1;
  }
 } while (0);
 if (c[j >> 2] | 0) {
  j = c[j >> 2] | 0;
  i = k;
  return j | 0;
 }
 if (a[c[f >> 2] >> 0] | 0) {
  j = c[j >> 2] | 0;
  i = k;
  return j | 0;
 }
 if ((a[c[h >> 2] >> 0] | 0) == 47) c[h >> 2] = (c[h >> 2] | 0) + 1;
 if ((c[g >> 2] | 0) != (c[h >> 2] | 0)) if ((a[(c[h >> 2] | 0) + -1 >> 0] | 0) != 47) {
  j = c[j >> 2] | 0;
  i = k;
  return j | 0;
 }
 while (1) {
  if (a[c[h >> 2] >> 0] | 0) b = (a[c[h >> 2] >> 0] | 0) == 47 ^ 1; else b = 0;
  d = c[h >> 2] | 0;
  if (!b) break;
  c[h >> 2] = d + 1;
 }
 c[j >> 2] = (a[d >> 0] | 0) == 0 & 1;
 j = c[j >> 2] | 0;
 i = k;
 return j | 0;
}

function th(b, d, e, f, g) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 var h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 r = i;
 i = i + 64 | 0;
 h = r + 56 | 0;
 j = r + 52 | 0;
 s = r + 48 | 0;
 k = r + 44 | 0;
 l = r + 40 | 0;
 m = r + 36 | 0;
 n = r + 32 | 0;
 p = r + 20 | 0;
 t = r + 8 | 0;
 o = r + 4 | 0;
 q = r;
 c[h >> 2] = b;
 c[j >> 2] = d;
 c[s >> 2] = e;
 c[k >> 2] = f;
 c[l >> 2] = g;
 zh(t, c[s >> 2] | 0, c[k >> 2] | 0);
 c[p >> 2] = c[t >> 2];
 c[p + 4 >> 2] = c[t + 4 >> 2];
 c[p + 8 >> 2] = c[t + 8 >> 2];
 if ((a[(c[s >> 2] | 0) + ((c[k >> 2] | 0) - 1) >> 0] | 0) != 47) za(29175, 29250, 131, 29308);
 c[m >> 2] = Rh(c[p >> 2] | 0) | 0;
 if (!(c[m >> 2] | 0)) {
  Ah(p);
  i = r;
  return;
 }
 if (!(a[c[l >> 2] >> 0] | 0)) vh(c[j >> 2] | 0, c[p >> 2] | 0); else {
  Dh(p, c[l >> 2] | 0);
  rh(c[h >> 2] | 0, c[j >> 2] | 0, c[p >> 2] | 0, c[k >> 2] | 0);
  Eh(p, c[k >> 2] | 0);
 }
 while (1) {
  t = Sh(c[m >> 2] | 0) | 0;
  c[n >> 2] = t;
  if (!t) break;
  if ((a[(c[n >> 2] | 0) + 11 >> 0] | 0) == 46) continue;
  Dh(p, (c[n >> 2] | 0) + 11 | 0);
  c[o >> 2] = Kh(c[h >> 2] | 0, c[p >> 2] | 0, 0) | 0;
  do if ((c[o >> 2] | 0) >= 0) {
   c[q >> 2] = c[p + 8 >> 2];
   Dh(p, 29173);
   if (a[c[l >> 2] >> 0] | 0) {
    Dh(p, c[l >> 2] | 0);
    rh(c[h >> 2] | 0, c[j >> 2] | 0, c[p >> 2] | 0, c[q >> 2] | 0);
    Eh(p, c[q >> 2] | 0);
   }
   if ((c[o >> 2] | 0) != 2) {
    th(c[h >> 2] | 0, c[j >> 2] | 0, c[p >> 2] | 0, c[q >> 2] | 0, c[l >> 2] | 0);
    break;
   }
   if (!(a[c[l >> 2] >> 0] | 0)) vh(c[j >> 2] | 0, c[p >> 2] | 0);
  } while (0);
  Eh(p, c[k >> 2] | 0);
 }
 Ah(p);
 Ih(c[m >> 2] | 0);
 i = r;
 return;
}

function Td() {
 var b = 0;
 Dd(1468, 9384);
 b = c[367] | 0;
 if ((d[9384] | 0 | 0) != 1) {
  Ed(b, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 if (!((c[(c[63] | 0) + (b + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) | 0)) {
  Cd(c[323] | 0, 1);
  return;
 }
 c[365] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
 c[366] = c[(c[63] | 0) + (c[367] << 2) >> 2];
 do {
  if ((c[365] | 0) <= (c[366] | 0)) break;
  c[365] = (c[365] | 0) - 1;
 } while ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 125);
 switch (d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) {
 case 33:
 case 63:
 case 46:
  {
   if ((c[(c[383] | 0) + (c[382] << 2) >> 2] | 0) >= (c[386] | 0)) {
    c[22] = (c[22] | 0) + 1;
    c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
   }
   c[382] = (c[382] | 0) + 1;
   return;
  }
 default:
  {}
 }
 a : do if ((c[367] | 0) < (c[386] | 0)) {
  while (1) {
   if (((c[259] | 0) + ((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0)) + 1 | 0) <= (c[65] | 0)) break;
   Bb();
  }
  c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
  c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
  while (1) {
   if ((c[365] | 0) >= (c[366] | 0)) break a;
   a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
   c[259] = (c[259] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
 } else {
  c[259] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
  while (1) {
   if (((c[259] | 0) + 1 | 0) <= (c[65] | 0)) break a;
   Bb();
  }
 } while (0);
 a[(c[64] | 0) + (c[259] | 0) >> 0] = 46;
 c[259] = (c[259] | 0) + 1;
 Cd(Lc() | 0, 1);
 return;
}

function yg(a, b, d, e, f) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 s = i;
 i = i + 64 | 0;
 g = s + 56 | 0;
 h = s + 52 | 0;
 j = s + 48 | 0;
 k = s + 44 | 0;
 o = s + 40 | 0;
 r = s + 32 | 0;
 p = s + 24 | 0;
 l = s + 20 | 0;
 q = s + 16 | 0;
 t = s + 8 | 0;
 m = s + 4 | 0;
 n = s;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[p >> 2] = si(c[j >> 2] | 0) | 0;
 c[l >> 2] = 75;
 c[q >> 2] = kh(c[l >> 2] | 0) | 0;
 sg(t);
 c[r >> 2] = c[t >> 2];
 c[r + 4 >> 2] = c[t + 4 >> 2];
 c[o >> 2] = c[c[h >> 2] >> 2];
 while (1) {
  if (!(c[o >> 2] | 0)) {
   g = 11;
   break;
  }
  c[m >> 2] = c[c[o >> 2] >> 2];
  c[n >> 2] = si(c[m >> 2] | 0) | 0;
  while (1) {
   if (((c[n >> 2] | 0) + (c[p >> 2] | 0) + 1 | 0) >>> 0 <= (c[l >> 2] | 0) >>> 0) break;
   c[l >> 2] = (c[l >> 2] | 0) + (c[l >> 2] | 0);
   c[q >> 2] = mh(c[q >> 2] | 0, c[l >> 2] | 0) | 0;
  }
  zi(c[q >> 2] | 0, c[m >> 2] | 0) | 0;
  pi(c[q >> 2] | 0, c[j >> 2] | 0) | 0;
  if (Jg(c[g >> 2] | 0, c[q >> 2] | 0) | 0) {
   Lg(r, c[q >> 2] | 0);
   Tg(c[h >> 2] | 0, c[o >> 2] | 0);
   if (!(c[k >> 2] | 0)) {
    g = 8;
    break;
   }
   c[l >> 2] = 75;
   c[q >> 2] = kh(c[l >> 2] | 0) | 0;
  }
  c[o >> 2] = c[(c[o >> 2] | 0) + 8 >> 2];
 }
 if ((g | 0) == 8) {
  c[a >> 2] = c[r >> 2];
  c[a + 4 >> 2] = c[r + 4 >> 2];
  i = s;
  return;
 } else if ((g | 0) == 11) {
  Cj(c[q >> 2] | 0);
  c[a >> 2] = c[r >> 2];
  c[a + 4 >> 2] = c[r + 4 >> 2];
  i = s;
  return;
 }
}

function fg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 l = i;
 i = i + 64 | 0;
 o = l + 56 | 0;
 k = l + 8 | 0;
 f = l;
 d = l + 52 | 0;
 e = l + 48 | 0;
 j = l + 40 | 0;
 m = l + 32 | 0;
 n = l + 24 | 0;
 g = l + 16 | 0;
 h = l + 12 | 0;
 c[d >> 2] = b;
 b = c[d >> 2] | 0;
 c[o >> 2] = c[a >> 2];
 c[o + 4 >> 2] = c[a + 4 >> 2];
 c[m >> 2] = hg(o, b) | 0;
 jg(n);
 c[j >> 2] = c[n >> 2];
 c[j + 4 >> 2] = c[n + 4 >> 2];
 c[e >> 2] = c[(c[a >> 2] | 0) + (c[m >> 2] << 2) >> 2];
 while (1) {
  if (!(c[e >> 2] | 0)) break;
  if (c[d >> 2] | 0) if (c[c[e >> 2] >> 2] | 0) if (!(Ci(c[d >> 2] | 0, c[c[e >> 2] >> 2] | 0) | 0)) Mg(j, c[(c[e >> 2] | 0) + 4 >> 2] | 0);
  c[e >> 2] = c[(c[e >> 2] | 0) + 8 >> 2];
 }
 if (c[j + 4 >> 2] | 0) Mg(j, 0);
 c[g >> 2] = c[736];
 if (!(c[(c[g >> 2] | 0) + 44 >> 2] & 2)) {
  o = j + 4 | 0;
  o = c[o >> 2] | 0;
  i = l;
  return o | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 o = c[1840] | 0;
 c[f >> 2] = c[d >> 2];
 $i(o, 20782, f) | 0;
 ij(c[1840] | 0) | 0;
 if (c[j + 4 >> 2] | 0) {
  c[h >> 2] = c[j + 4 >> 2];
  while (1) {
   d = c[1840] | 0;
   if (!(c[c[h >> 2] >> 2] | 0)) break;
   Vi(32, d) | 0;
   if (c[(c[g >> 2] | 0) + 76 >> 2] | 0) {
    o = c[1840] | 0;
    c[k >> 2] = c[c[h >> 2] >> 2];
    $i(o, 20809, k) | 0;
   } else Qi(c[c[h >> 2] >> 2] | 0, c[1840] | 0) | 0;
   c[h >> 2] = (c[h >> 2] | 0) + 4;
  }
  Vi(10, d) | 0;
 } else Qi(20801, c[1840] | 0) | 0;
 ij(c[1840] | 0) | 0;
 o = j + 4 | 0;
 o = c[o >> 2] | 0;
 i = l;
 return o | 0;
}

function Og(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 d = k + 20 | 0;
 e = k + 16 | 0;
 h = k + 12 | 0;
 j = k + 8 | 0;
 f = k + 4 | 0;
 g = k;
 c[d >> 2] = a;
 if (!(c[b >> 2] | 0)) {
  i = k;
  return;
 }
 if (!(c[c[d >> 2] >> 2] | 0)) {
  c[c[d >> 2] >> 2] = c[b >> 2];
  a = kh(c[b >> 2] << 2) | 0;
  c[(c[d >> 2] | 0) + 4 >> 2] = a;
  c[e >> 2] = 0;
  while (1) {
   if ((c[e >> 2] | 0) == (c[b >> 2] | 0)) break;
   a = nh(c[(c[b + 4 >> 2] | 0) + (c[e >> 2] << 2) >> 2] | 0) | 0;
   c[(c[(c[d >> 2] | 0) + 4 >> 2] | 0) + (c[e >> 2] << 2) >> 2] = a;
   c[e >> 2] = (c[e >> 2] | 0) + 1;
  }
  i = k;
  return;
 }
 c[j >> 2] = kh((_(c[c[d >> 2] >> 2] | 0, c[b >> 2] | 0) | 0) << 2) | 0;
 c[h >> 2] = 0;
 c[g >> 2] = 0;
 while (1) {
  a = (c[g >> 2] | 0) != (c[b >> 2] | 0);
  c[f >> 2] = 0;
  if (!a) break;
  while (1) {
   if ((c[f >> 2] | 0) == (c[c[d >> 2] >> 2] | 0)) break;
   a = Df(c[(c[(c[d >> 2] | 0) + 4 >> 2] | 0) + (c[f >> 2] << 2) >> 2] | 0, c[(c[b + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0;
   c[(c[j >> 2] | 0) + (c[h >> 2] << 2) >> 2] = a;
   c[h >> 2] = (c[h >> 2] | 0) + 1;
   c[f >> 2] = (c[f >> 2] | 0) + 1;
  }
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 while (1) {
  if ((c[f >> 2] | 0) == (c[c[d >> 2] >> 2] | 0)) break;
  Cj(c[(c[(c[d >> 2] | 0) + 4 >> 2] | 0) + (c[f >> 2] << 2) >> 2] | 0);
  c[f >> 2] = (c[f >> 2] | 0) + 1;
 }
 Cj(c[(c[d >> 2] | 0) + 4 >> 2] | 0);
 c[c[d >> 2] >> 2] = c[h >> 2];
 c[(c[d >> 2] | 0) + 4 >> 2] = c[j >> 2];
 i = k;
 return;
}

function xb() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 a = i;
 i = i + 96 | 0;
 b = a + 80 | 0;
 d = a + 64 | 0;
 f = a + 48 | 0;
 g = a + 32 | 0;
 h = a + 16 | 0;
 j = a;
 k = c[11] | 0;
 l = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[j >> 2] = 9535;
 c[j + 4 >> 2] = 1;
 c[j + 8 >> 2] = l;
 c[j + 12 >> 2] = e;
 $i(k, 9481, j) | 0;
 c[15] = mh(c[15] | 0, (c[14] | 0) + 2e4 + 1 | 0) | 0;
 j = c[11] | 0;
 k = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[h >> 2] = 9542;
 c[h + 4 >> 2] = 1;
 c[h + 8 >> 2] = k;
 c[h + 12 >> 2] = e;
 $i(j, 9481, h) | 0;
 c[16] = mh(c[16] | 0, (c[14] | 0) + 2e4 + 1 | 0) | 0;
 h = c[11] | 0;
 j = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[g >> 2] = 9552;
 c[g + 4 >> 2] = 1;
 c[g + 8 >> 2] = j;
 c[g + 12 >> 2] = e;
 $i(h, 9481, g) | 0;
 c[17] = mh(c[17] | 0, (c[14] | 0) + 2e4 + 1 | 0) | 0;
 g = c[11] | 0;
 h = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[f >> 2] = 9559;
 c[f + 4 >> 2] = 1;
 c[f + 8 >> 2] = h;
 c[f + 12 >> 2] = e;
 $i(g, 9481, f) | 0;
 c[18] = mh(c[18] | 0, (c[14] | 0) + 2e4 + 1 | 0) | 0;
 f = c[11] | 0;
 g = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[d >> 2] = 9567;
 c[d + 4 >> 2] = 4;
 c[d + 8 >> 2] = g;
 c[d + 12 >> 2] = e;
 $i(f, 9481, d) | 0;
 c[19] = mh(c[19] | 0, (c[14] | 0) + 2e4 + 1 << 2) | 0;
 d = c[11] | 0;
 f = (c[14] | 0) + 2e4 | 0;
 e = c[14] | 0;
 c[b >> 2] = 9576;
 c[b + 4 >> 2] = 1;
 c[b + 8 >> 2] = f;
 c[b + 12 >> 2] = e;
 $i(d, 9481, b) | 0;
 c[20] = mh(c[20] | 0, (c[14] | 0) + 2e4 + 1 | 0) | 0;
 c[14] = (c[14] | 0) + 2e4;
 i = a;
 return;
}

function kg(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 j = l + 16 | 0;
 f = l + 12 | 0;
 h = l + 8 | 0;
 k = l + 4 | 0;
 g = l;
 c[l + 20 >> 2] = b;
 c[j >> 2] = d;
 c[f >> 2] = e;
 if (!(c[f >> 2] | 0)) za(20897, 20906, 40, 20964);
 if (!(c[j >> 2] | 0)) {
  c[k >> 2] = nh(c[f >> 2] | 0) | 0;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 }
 b = c[j >> 2] | 0;
 if ((a[c[j >> 2] >> 0] | 0) == 58) {
  e = c[f >> 2] | 0;
  if (!(a[b + 1 >> 0] | 0)) e = nh(e) | 0; else e = Df(e, c[j >> 2] | 0) | 0;
  c[k >> 2] = e;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 }
 d = si(b) | 0;
 c[h >> 2] = d;
 e = c[j >> 2] | 0;
 if ((a[(c[j >> 2] | 0) + (d - 1) >> 0] | 0) == 58) {
  c[k >> 2] = Df(e, c[f >> 2] | 0) | 0;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 }
 c[g >> 2] = e;
 while (1) {
  if (!(a[c[g >> 2] >> 0] | 0)) break;
  if ((a[c[g >> 2] >> 0] | 0) == 58) if ((a[(c[g >> 2] | 0) + 1 >> 0] | 0) == 58) break;
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 if (a[c[g >> 2] >> 0] | 0) {
  h = c[h >> 2] | 0;
  c[k >> 2] = kh(h + (si(c[f >> 2] | 0) | 0) + 1 | 0) | 0;
  Ai(c[k >> 2] | 0, c[j >> 2] | 0, (c[g >> 2] | 0) - (c[j >> 2] | 0) + 1 | 0) | 0;
  a[(c[k >> 2] | 0) + ((c[g >> 2] | 0) - (c[j >> 2] | 0) + 1) >> 0] = 0;
  pi(c[k >> 2] | 0, c[f >> 2] | 0) | 0;
  pi(c[k >> 2] | 0, (c[g >> 2] | 0) + 1 | 0) | 0;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 } else {
  c[k >> 2] = nh(c[j >> 2] | 0) | 0;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 }
 return 0;
}

function bj(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 o = i;
 i = i + 112 | 0;
 n = o + 40 | 0;
 l = o + 24 | 0;
 k = o + 16 | 0;
 g = o;
 m = o + 52 | 0;
 f = a[d >> 0] | 0;
 if (!(ti(31441, f << 24 >> 24, 4) | 0)) {
  c[(Hi() | 0) >> 2] = 22;
  e = 0;
 } else {
  e = Bj(1144) | 0;
  if (!e) e = 0; else {
   h = e;
   j = h + 112 | 0;
   do {
    c[h >> 2] = 0;
    h = h + 4 | 0;
   } while ((h | 0) < (j | 0));
   if (!(ui(d, 43) | 0)) c[e >> 2] = f << 24 >> 24 == 114 ? 8 : 4;
   if (ui(d, 101) | 0) {
    c[g >> 2] = b;
    c[g + 4 >> 2] = 2;
    c[g + 8 >> 2] = 1;
    Ia(221, g | 0) | 0;
    f = a[d >> 0] | 0;
   }
   if (f << 24 >> 24 == 97) {
    c[k >> 2] = b;
    c[k + 4 >> 2] = 3;
    f = Ia(221, k | 0) | 0;
    if (!(f & 1024)) {
     c[l >> 2] = b;
     c[l + 4 >> 2] = 4;
     c[l + 8 >> 2] = f | 1024;
     Ia(221, l | 0) | 0;
    }
    d = c[e >> 2] | 128;
    c[e >> 2] = d;
   } else d = c[e >> 2] | 0;
   c[e + 60 >> 2] = b;
   c[e + 44 >> 2] = e + 120;
   c[e + 48 >> 2] = 1024;
   f = e + 75 | 0;
   a[f >> 0] = -1;
   if (!(d & 8)) {
    c[n >> 2] = b;
    c[n + 4 >> 2] = 21505;
    c[n + 8 >> 2] = m;
    if (!(Na(54, n | 0) | 0)) a[f >> 0] = 10;
   }
   c[e + 32 >> 2] = 2;
   c[e + 36 >> 2] = 5;
   c[e + 40 >> 2] = 3;
   c[e + 12 >> 2] = 1;
   if (!(c[1842] | 0)) c[e + 76 >> 2] = -1;
   Sa(7392);
   f = c[1847] | 0;
   c[e + 56 >> 2] = f;
   if (f) c[f + 52 >> 2] = e;
   c[1847] = e;
   Oa(7392);
  }
 }
 i = o;
 return e | 0;
}

function Ri(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0;
 q = i;
 i = i + 48 | 0;
 n = q + 16 | 0;
 m = q;
 e = q + 32 | 0;
 o = a + 28 | 0;
 f = c[o >> 2] | 0;
 c[e >> 2] = f;
 p = a + 20 | 0;
 f = (c[p >> 2] | 0) - f | 0;
 c[e + 4 >> 2] = f;
 c[e + 8 >> 2] = b;
 c[e + 12 >> 2] = d;
 k = a + 60 | 0;
 l = a + 44 | 0;
 b = 2;
 f = f + d | 0;
 while (1) {
  if (!(c[1841] | 0)) {
   c[n >> 2] = c[k >> 2];
   c[n + 4 >> 2] = e;
   c[n + 8 >> 2] = b;
   h = rj(ab(146, n | 0) | 0) | 0;
  } else {
   na(3, a | 0);
   c[m >> 2] = c[k >> 2];
   c[m + 4 >> 2] = e;
   c[m + 8 >> 2] = b;
   h = rj(ab(146, m | 0) | 0) | 0;
   ja(0);
  }
  if ((f | 0) == (h | 0)) {
   f = 6;
   break;
  }
  if ((h | 0) < 0) {
   f = 8;
   break;
  }
  f = f - h | 0;
  g = c[e + 4 >> 2] | 0;
  if (h >>> 0 > g >>> 0) {
   j = c[l >> 2] | 0;
   c[o >> 2] = j;
   c[p >> 2] = j;
   j = c[e + 12 >> 2] | 0;
   h = h - g | 0;
   e = e + 8 | 0;
   b = b + -1 | 0;
  } else if ((b | 0) == 2) {
   c[o >> 2] = (c[o >> 2] | 0) + h;
   j = g;
   b = 2;
  } else j = g;
  c[e >> 2] = (c[e >> 2] | 0) + h;
  c[e + 4 >> 2] = j - h;
 }
 if ((f | 0) == 6) {
  n = c[l >> 2] | 0;
  c[a + 16 >> 2] = n + (c[a + 48 >> 2] | 0);
  a = n;
  c[o >> 2] = a;
  c[p >> 2] = a;
 } else if ((f | 0) == 8) {
  c[a + 16 >> 2] = 0;
  c[o >> 2] = 0;
  c[p >> 2] = 0;
  c[a >> 2] = c[a >> 2] | 32;
  if ((b | 0) == 2) d = 0; else d = d - (c[e + 4 >> 2] | 0) | 0;
 }
 i = q;
 return d | 0;
}

function Ae() {
 var b = 0;
 if (!(id() | 0)) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 ed(125, 37, 37);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  cc();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 c[333] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
 b = c[333] | 0;
 if (c[263] | 0) {
  fc(b);
  return;
 }
 a[(c[166] | 0) + b >> 0] = 1;
 if ((c[(c[167] | 0) + (c[333] << 2) >> 2] | 0) == (c[324] | 0)) c[325] = c[333];
 if (!(id() | 0)) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(12592, c[11] | 0) | 0;
  Qi(12592, c[12] | 0) | 0;
  Yb();
  return;
 } else {
  c[67] = (c[67] | 0) + 1;
  nd(c[333] | 0);
  return;
 }
}

function Ze(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0, t = 0;
 o = i;
 i = i + 80 | 0;
 r = o + 40 | 0;
 q = o + 32 | 0;
 t = o + 24 | 0;
 s = o + 16 | 0;
 p = o;
 g = o + 76 | 0;
 h = o + 72 | 0;
 j = o + 68 | 0;
 k = o + 64 | 0;
 m = o + 60 | 0;
 l = o + 56 | 0;
 n = o + 52 | 0;
 o = o + 48 | 0;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[k >> 2] = f;
 c[n >> 2] = ui(c[g >> 2] | 0, 44) | 0;
 c[o >> 2] = ri(c[g >> 2] | 0, 32) | 0;
 if (!((c[n >> 2] | 0) != 0 & (c[o >> 2] | 0) != 0)) za(16069, 16099, 33, 16165);
 c[o >> 2] = (c[o >> 2] | 0) + 1;
 c[l >> 2] = (c[n >> 2] | 0) - (c[g >> 2] | 0) - 8;
 c[m >> 2] = kh((c[l >> 2] | 0) + 1 | 0) | 0;
 Ai(c[m >> 2] | 0, (c[g >> 2] | 0) + 8 | 0, c[l >> 2] | 0) | 0;
 a[(c[m >> 2] | 0) + (c[l >> 2] | 0) >> 0] = 0;
 n = c[o >> 2] | 0;
 o = c[730] | 0;
 c[p >> 2] = c[m >> 2];
 c[p + 4 >> 2] = n;
 c[p + 8 >> 2] = o;
 lj(16185, p) | 0;
 mj(c[1779] | 0) | 0;
 if (c[h >> 2] | 0) {
  c[s >> 2] = c[h >> 2];
  lj(16194, s) | 0;
  if (!(c[j >> 2] | 0)) c[j >> 2] = c[h >> 2];
 }
 mj(16214) | 0;
 Qi(16272, c[1838] | 0) | 0;
 c[t >> 2] = c[m >> 2];
 lj(16297, t) | 0;
 mj(16324) | 0;
 mj(16363) | 0;
 c[q >> 2] = c[m >> 2];
 lj(16418, q) | 0;
 t = c[j >> 2] | 0;
 c[r >> 2] = c[m >> 2];
 c[r + 4 >> 2] = t;
 lj(16452, r) | 0;
 if (!(c[k >> 2] | 0)) $e(0);
 Qi(c[k >> 2] | 0, c[1838] | 0) | 0;
 $e(0);
}

function Jg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 112 | 0;
 f = m + 96 | 0;
 e = m + 92 | 0;
 g = m + 88 | 0;
 k = m + 12 | 0;
 h = m + 8 | 0;
 j = m + 4 | 0;
 l = m;
 c[e >> 2] = b;
 c[g >> 2] = d;
 oh(c[e >> 2] | 0, c[g >> 2] | 0) | 0;
 if (!(bi(c[g >> 2] | 0, 4) | 0)) if (!(Uh(c[g >> 2] | 0, k) | 0)) if ((c[k + 12 >> 2] & 61440 | 0) != 16384) {
  c[f >> 2] = c[g >> 2];
  l = c[f >> 2] | 0;
  i = m;
  return l | 0;
 }
 if ((c[(Hi() | 0) >> 2] | 0) == 36) {
  c[h >> 2] = 0;
  c[j >> 2] = c[g >> 2];
  c[l >> 2] = c[g >> 2];
  while (1) {
   e = c[h >> 2] | 0;
   if (!(a[c[j >> 2] >> 0] | 0)) break;
   if (e >>> 0 <= 255) c[l >> 2] = c[j >> 2];
   e = c[h >> 2] | 0;
   if ((a[c[j >> 2] >> 0] | 0) == 47) {
    if (e >>> 0 > 255) {
     b = c[l >> 2] | 0;
     d = c[j >> 2] | 0;
     Qj(b | 0, d | 0, (si(c[j >> 2] | 0) | 0) + 1 | 0) | 0;
     c[j >> 2] = c[l >> 2];
    }
    c[h >> 2] = 0;
   } else c[h >> 2] = e + 1;
   c[j >> 2] = (c[j >> 2] | 0) + 1;
  }
  if (e >>> 0 > 255) a[c[l >> 2] >> 0] = 0;
  if (!(bi(c[g >> 2] | 0, 4) | 0)) if (!(Uh(c[g >> 2] | 0, k) | 0)) if ((c[k + 12 >> 2] & 61440 | 0) != 16384) {
   c[f >> 2] = c[g >> 2];
   l = c[f >> 2] | 0;
   i = m;
   return l | 0;
  }
 } else if ((c[(Hi() | 0) >> 2] | 0) == 13) if (!(Ug(c[e >> 2] | 0, 27862) | 0)) Li(c[g >> 2] | 0);
 c[f >> 2] = 0;
 l = c[f >> 2] | 0;
 i = m;
 return l | 0;
}

function Le() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 b = k + 24 | 0;
 f = k + 20 | 0;
 d = k + 16 | 0;
 h = k + 12 | 0;
 j = k + 8 | 0;
 g = k + 4 | 0;
 e = k;
 c[b >> 2] = ((c[267] | 0) / 20 | 0) * 17;
 c[d >> 2] = 1;
 c[f >> 2] = 1;
 c[262] = 2;
 c[(c[265] | 0) + (c[f >> 2] << 2) >> 2] = c[262];
 c[h >> 2] = 2;
 c[j >> 2] = 9;
 while (1) {
  if ((c[262] | 0) >= (c[b >> 2] | 0)) break;
  do {
   c[d >> 2] = (c[d >> 2] | 0) + 2;
   if ((c[d >> 2] | 0) == (c[j >> 2] | 0)) {
    c[(c[167] | 0) + (c[h >> 2] << 2) >> 2] = c[d >> 2];
    c[d >> 2] = (c[d >> 2] | 0) + 2;
    c[h >> 2] = (c[h >> 2] | 0) + 1;
    c[j >> 2] = _(c[(c[265] | 0) + (c[h >> 2] << 2) >> 2] | 0, c[(c[265] | 0) + (c[h >> 2] << 2) >> 2] | 0) | 0;
   }
   c[g >> 2] = 2;
   c[e >> 2] = 1;
   while (1) {
    if (!((c[g >> 2] | 0) < (c[h >> 2] | 0) ? (c[e >> 2] | 0) != 0 : 0)) break;
    while (1) {
     a = c[(c[167] | 0) + (c[g >> 2] << 2) >> 2] | 0;
     if ((c[(c[167] | 0) + (c[g >> 2] << 2) >> 2] | 0) >= (c[d >> 2] | 0)) break;
     c[(c[167] | 0) + (c[g >> 2] << 2) >> 2] = a + (c[(c[265] | 0) + (c[g >> 2] << 2) >> 2] << 1);
    }
    if ((a | 0) == (c[d >> 2] | 0)) c[e >> 2] = 0;
    c[g >> 2] = (c[g >> 2] | 0) + 1;
   }
  } while ((c[e >> 2] | 0) != 0 ^ 1);
  c[f >> 2] = (c[f >> 2] | 0) + 1;
  c[262] = c[d >> 2];
  c[(c[265] | 0) + (c[f >> 2] << 2) >> 2] = c[262];
 }
 i = k;
 return;
}

function Kh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 o = i;
 i = i + 128 | 0;
 e = o + 112 | 0;
 m = o;
 f = o + 108 | 0;
 g = o + 104 | 0;
 h = o + 100 | 0;
 k = o + 96 | 0;
 j = o + 88 | 0;
 l = o + 8 | 0;
 c[f >> 2] = a;
 c[g >> 2] = b;
 c[h >> 2] = d;
 if (!(c[(c[f >> 2] | 0) + 48 + 4 >> 2] | 0)) {
  d = (c[f >> 2] | 0) + 48 | 0;
  cg(j, 457);
  c[d >> 2] = c[j >> 2];
  c[d + 4 >> 2] = c[j + 4 >> 2];
 }
 if (c[(c[f >> 2] | 0) + 44 >> 2] & 2) c[(c[f >> 2] | 0) + 76 >> 2] = 1;
 a = (c[f >> 2] | 0) + 48 | 0;
 d = c[g >> 2] | 0;
 c[e >> 2] = c[a >> 2];
 c[e + 4 >> 2] = c[a + 4 >> 2];
 c[k >> 2] = fg(e, d) | 0;
 if (c[(c[f >> 2] | 0) + 44 >> 2] & 2) c[(c[f >> 2] | 0) + 76 >> 2] = 0;
 if (c[k >> 2] | 0) {
  c[h >> 2] = c[c[k >> 2] >> 2];
  n = c[h >> 2] | 0;
  i = o;
  return n | 0;
 }
 if (!(Uh(c[g >> 2] | 0, l) | 0)) if ((c[l + 12 >> 2] & 61440 | 0) == 16384) c[h >> 2] = c[l + 16 >> 2]; else n = 12; else n = 12;
 if ((n | 0) == 12) c[h >> 2] = -1;
 l = (c[f >> 2] | 0) + 48 | 0;
 n = nh(c[g >> 2] | 0) | 0;
 dg(l, n, c[h >> 2] | 0);
 if (!(c[(c[f >> 2] | 0) + 44 >> 2] & 1)) {
  n = c[h >> 2] | 0;
  i = o;
  return n | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 n = c[1840] | 0;
 l = c[h >> 2] | 0;
 c[m >> 2] = c[g >> 2];
 c[m + 4 >> 2] = l;
 $i(n, 29474, m) | 0;
 ij(c[1840] | 0) | 0;
 n = c[h >> 2] | 0;
 i = o;
 return n | 0;
}

function gh(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 e = k + 16 | 0;
 f = k + 12 | 0;
 j = k + 8 | 0;
 g = k + 4 | 0;
 h = k;
 c[f >> 2] = b;
 c[g >> 2] = 0;
 if (!(c[f >> 2] | 0)) {
  c[e >> 2] = 0;
  j = c[e >> 2] | 0;
  i = k;
  return j | 0;
 }
 c[h >> 2] = si(c[f >> 2] | 0) | 0;
 while (1) {
  if ((c[h >> 2] | 0) >>> 0 <= (c[g >> 2] | 0) >>> 0) break;
  if (!((a[(c[f >> 2] | 0) + ((c[h >> 2] | 0) - 1) >> 0] | 0) == 47 ^ 1)) break;
  c[h >> 2] = (c[h >> 2] | 0) + -1;
 }
 do if ((c[h >> 2] | 0) == (c[g >> 2] | 0)) {
  if (!(c[g >> 2] | 0)) {
   c[j >> 2] = nh(34049) | 0;
   break;
  }
  if ((c[g >> 2] | 0) == 2) {
   c[j >> 2] = kh(4) | 0;
   a[c[j >> 2] >> 0] = a[c[f >> 2] >> 0] | 0;
   a[(c[j >> 2] | 0) + 1 >> 0] = a[(c[f >> 2] | 0) + 1 >> 0] | 0;
   a[(c[j >> 2] | 0) + 2 >> 0] = 46;
   a[(c[j >> 2] | 0) + 3 >> 0] = 0;
   break;
  } else {
   c[j >> 2] = nh(c[f >> 2] | 0) | 0;
   break;
  }
 } else {
  while (1) {
   if ((c[h >> 2] | 0) >>> 0 > ((c[g >> 2] | 0) + 1 | 0) >>> 0) d = (a[(c[f >> 2] | 0) + ((c[h >> 2] | 0) - 1) >> 0] | 0) == 47; else d = 0;
   b = c[h >> 2] | 0;
   if (!d) break;
   c[h >> 2] = b + -1;
  }
  c[j >> 2] = kh(b + 1 | 0) | 0;
  Ai(c[j >> 2] | 0, c[f >> 2] | 0, c[h >> 2] | 0) | 0;
  a[(c[j >> 2] | 0) + (c[h >> 2] | 0) >> 0] = 0;
 } while (0);
 c[e >> 2] = c[j >> 2];
 j = c[e >> 2] | 0;
 i = k;
 return j | 0;
}

function Ub(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 h = i;
 i = i + 80 | 0;
 f = h + 48 | 0;
 e = h + 32 | 0;
 g = h + 16 | 0;
 d = h;
 b = h + 64 | 0;
 c[b >> 2] = a;
 if ((c[b >> 2] | 0) != (c[120] | 0)) {
  i = h;
  return;
 }
 a = c[11] | 0;
 k = (c[120] | 0) + 750 | 0;
 j = c[120] | 0;
 c[d >> 2] = 9938;
 c[d + 4 >> 2] = 4;
 c[d + 8 >> 2] = k;
 c[d + 12 >> 2] = j;
 $i(a, 9481, d) | 0;
 c[121] = mh(c[121] | 0, (c[120] | 0) + 750 + 1 << 2) | 0;
 a = c[11] | 0;
 j = (c[120] | 0) + 750 | 0;
 d = c[120] | 0;
 c[g >> 2] = 9948;
 c[g + 4 >> 2] = 4;
 c[g + 8 >> 2] = j;
 c[g + 12 >> 2] = d;
 $i(a, 9481, g) | 0;
 c[122] = mh(c[122] | 0, (c[120] | 0) + 750 + 1 << 2) | 0;
 g = c[11] | 0;
 a = (c[120] | 0) + 750 | 0;
 d = c[120] | 0;
 c[e >> 2] = 9958;
 c[e + 4 >> 2] = 4;
 c[e + 8 >> 2] = a;
 c[e + 12 >> 2] = d;
 $i(g, 9481, e) | 0;
 c[123] = mh(c[123] | 0, (c[120] | 0) + 750 + 1 << 2) | 0;
 g = c[11] | 0;
 d = (c[120] | 0) + 750 | 0;
 e = c[120] | 0;
 c[f >> 2] = 9971;
 c[f + 4 >> 2] = 4;
 c[f + 8 >> 2] = d;
 c[f + 12 >> 2] = e;
 $i(g, 9481, f) | 0;
 c[124] = mh(c[124] | 0, (c[120] | 0) + 750 + 1 << 2) | 0;
 c[120] = (c[120] | 0) + 750;
 while (1) {
  if ((c[b >> 2] | 0) >= (c[120] | 0)) break;
  c[(c[122] | 0) + (c[b >> 2] << 2) >> 2] = 0;
  c[(c[124] | 0) + (c[b >> 2] << 2) >> 2] = 0;
  c[b >> 2] = (c[b >> 2] | 0) + 1;
 }
 i = h;
 return;
}

function Je() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 e = i;
 i = i + 32 | 0;
 b = e + 16 | 0;
 a = e;
 if (!(dd() | 0)) {
  f = c[11] | 0;
  g = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[a >> 2] = 34;
  c[a + 4 >> 2] = g;
  c[a + 8 >> 2] = 15220;
  $i(f, 10265, a) | 0;
  a = c[12] | 0;
  f = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[b >> 2] = 34;
  c[b + 4 >> 2] = f;
  c[b + 8 >> 2] = 15220;
  $i(a, 10265, b) | 0;
  Yb();
  i = e;
  return;
 }
 Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 g = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 4, 0) | 0;
 c[343] = c[(c[271] | 0) + (g << 2) >> 2];
 if (!(c[263] | 0)) {
  Db();
  Qi(15255, c[11] | 0) | 0;
  Qi(15255, c[12] | 0) | 0;
  Yb();
  i = e;
  return;
 }
 do switch (c[343] | 0) {
 case 0:
  {
   xe();
   i = e;
   return;
  }
 case 1:
  {
   ze();
   i = e;
   return;
  }
 case 2:
  {
   Ae();
   i = e;
   return;
  }
 case 3:
  {
   Be();
   i = e;
   return;
  }
 case 4:
  {
   Ce();
   i = e;
   return;
  }
 case 5:
  {
   De();
   i = e;
   return;
  }
 case 6:
  {
   Fe();
   i = e;
   return;
  }
 case 7:
  {
   Ge();
   i = e;
   return;
  }
 case 8:
  {
   He();
   i = e;
   return;
  }
 case 9:
  {
   Ie();
   i = e;
   return;
  }
 default:
  {
   Qi(15289, c[11] | 0) | 0;
   Qi(15289, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
 } while (0);
}

function $g(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 32 | 0;
 l = m;
 h = m + 24 | 0;
 j = m + 20 | 0;
 f = m + 16 | 0;
 k = m + 12 | 0;
 e = m + 8 | 0;
 c[h >> 2] = b;
 c[j >> 2] = d;
 if (!(c[(c[h >> 2] | 0) + 112 >> 2] | 0)) za(28607, 28626, 36, 28684);
 c[f >> 2] = Ef(c[j >> 2] | 0, 34049, c[(c[h >> 2] | 0) + 112 >> 2] | 0) | 0;
 c[e >> 2] = Ka(c[f >> 2] | 0) | 0;
 Cj(c[f >> 2] | 0);
 if (c[e >> 2] | 0) {
  if (!(a[c[e >> 2] >> 0] | 0)) g = 5;
 } else g = 5;
 if ((g | 0) == 5) {
  c[f >> 2] = Ef(c[j >> 2] | 0, 28703, c[(c[h >> 2] | 0) + 112 >> 2] | 0) | 0;
  c[e >> 2] = Ka(c[f >> 2] | 0) | 0;
  Cj(c[f >> 2] | 0);
 }
 if (c[e >> 2] | 0) {
  if (!(a[c[e >> 2] >> 0] | 0)) g = 8;
 } else g = 8;
 if ((g | 0) == 8) c[e >> 2] = Ka(c[j >> 2] | 0) | 0;
 if (c[e >> 2] | 0) {
  if (!(a[c[e >> 2] >> 0] | 0)) g = 11;
 } else g = 11;
 if ((g | 0) == 11) c[e >> 2] = Af(c[h >> 2] | 0, c[j >> 2] | 0) | 0;
 if (c[e >> 2] | 0) b = Sf(c[h >> 2] | 0, c[e >> 2] | 0) | 0; else b = 0;
 c[k >> 2] = b;
 if (!(c[(c[h >> 2] | 0) + 44 >> 2] & 64)) {
  l = c[k >> 2] | 0;
  i = m;
  return l | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 h = c[1840] | 0;
 g = (c[k >> 2] | 0) != 0 ? c[k >> 2] | 0 : 28705;
 c[l >> 2] = c[j >> 2];
 c[l + 4 >> 2] = g;
 $i(h, 28711, l) | 0;
 ij(c[1840] | 0) | 0;
 l = c[k >> 2] | 0;
 i = m;
 return l | 0;
}

function Ic() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 j = i;
 i = i + 96 | 0;
 f = j + 80 | 0;
 e = j + 64 | 0;
 b = j + 40 | 0;
 h = j + 24 | 0;
 g = j + 16 | 0;
 d = j + 8 | 0;
 a = j;
 k = c[11] | 0;
 l = c[179] | 0;
 c[a >> 2] = 11187;
 c[a + 4 >> 2] = l;
 $i(k, 9590, a) | 0;
 a = c[11] | 0;
 if ((c[179] | 0) == 1) {
  c[d >> 2] = 11200;
  $i(a, 16602, d) | 0;
 } else {
  c[g >> 2] = 11208;
  $i(a, 16602, g) | 0;
 }
 l = c[11] | 0;
 k = c[180] | 0;
 c[h >> 2] = 11227;
 c[h + 4 >> 2] = k;
 c[h + 8 >> 2] = 11240;
 $i(l, 11218, h) | 0;
 l = c[11] | 0;
 h = c[22] | 0;
 k = c[(c[63] | 0) + (c[22] << 2) >> 2] | 0;
 c[b >> 2] = 11227;
 c[b + 4 >> 2] = h;
 c[b + 8 >> 2] = 11287;
 c[b + 12 >> 2] = k;
 c[b + 16 >> 2] = 11302;
 $i(l, 11273, b) | 0;
 c[181] = 0;
 c[182] = 0;
 while (1) {
  if ((c[181] | 0) >= 37) break;
  c[182] = (c[182] | 0) + (c[732 + (c[181] << 2) >> 2] | 0);
  c[181] = (c[181] | 0) + 1;
 }
 l = c[11] | 0;
 k = c[182] | 0;
 c[e >> 2] = 11315;
 c[e + 4 >> 2] = k;
 c[e + 8 >> 2] = 11355;
 $i(l, 11218, e) | 0;
 c[181] = 0;
 while (1) {
  if ((c[181] | 0) >= 37) break;
  zb(c[11] | 0, c[(c[167] | 0) + (c[884 + (c[181] << 2) >> 2] << 2) >> 2] | 0);
  l = c[11] | 0;
  k = c[732 + (c[181] << 2) >> 2] | 0;
  c[f >> 2] = 11376;
  c[f + 4 >> 2] = k;
  $i(l, 11369, f) | 0;
  c[181] = (c[181] | 0) + 1;
 }
 i = j;
 return;
}

function Ve(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 e = k + 16 | 0;
 f = k + 12 | 0;
 h = k + 8 | 0;
 g = k + 4 | 0;
 j = k;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = zf((c[70] | 0) + 1 | 0, 0) | 0;
 if ((c[722] | 0) == 0 | (c[g >> 2] | 0) != 0) c[h >> 2] = (c[70] | 0) + 1; else c[h >> 2] = Ef(c[722] | 0, 29173, (c[70] | 0) + 1 | 0) | 0;
 d = ej(c[h >> 2] | 0, c[f >> 2] | 0) | 0;
 c[c[e >> 2] >> 2] = d;
 if (!(c[c[e >> 2] >> 2] | 0)) {
  c[j >> 2] = ah(28238) | 0;
  if (c[j >> 2] | 0) if (!((c[g >> 2] | 0) != 0 ? 1 : (a[c[j >> 2] >> 0] | 0) == 0)) {
   if ((c[h >> 2] | 0) != ((c[70] | 0) + 1 | 0)) Cj(c[h >> 2] | 0);
   c[h >> 2] = Ef(c[j >> 2] | 0, 29173, (c[70] | 0) + 1 | 0) | 0;
   j = ej(c[h >> 2] | 0, c[f >> 2] | 0) | 0;
   c[c[e >> 2] >> 2] = j;
  }
 }
 if (c[c[e >> 2] >> 2] | 0) {
  if ((c[h >> 2] | 0) != ((c[70] | 0) + 1 | 0)) {
   Cj(c[70] | 0);
   c[71] = si(c[h >> 2] | 0) | 0;
   c[70] = kh((c[71] | 0) + 2 | 0) | 0;
   zi((c[70] | 0) + 1 | 0, c[h >> 2] | 0) | 0;
  }
  Te(c[h >> 2] | 0);
 }
 if ((c[h >> 2] | 0) == ((c[70] | 0) + 1 | 0)) {
  j = c[e >> 2] | 0;
  j = c[j >> 2] | 0;
  j = (j | 0) != 0;
  j = j & 1;
  i = k;
  return j | 0;
 }
 Cj(c[h >> 2] | 0);
 j = c[e >> 2] | 0;
 j = c[j >> 2] | 0;
 j = (j | 0) != 0;
 j = j & 1;
 i = k;
 return j | 0;
}

function ph(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 48 | 0;
 m = n + 8 | 0;
 l = n;
 e = n + 32 | 0;
 f = n + 28 | 0;
 g = n + 24 | 0;
 k = n + 20 | 0;
 j = n + 16 | 0;
 h = n + 12 | 0;
 c[f >> 2] = b;
 c[g >> 2] = d;
 if (c[g >> 2] | 0) if (a[c[g >> 2] >> 0] | 0) {
  c[j >> 2] = oh(c[f >> 2] | 0, c[g >> 2] | 0) | 0;
  c[k >> 2] = qh(c[f >> 2] | 0, c[g >> 2] | 0) | 0;
  if (c[k >> 2] | 0) {
   c[e >> 2] = c[k >> 2];
   m = c[e >> 2] | 0;
   i = n;
   return m | 0;
  }
  c[k >> 2] = kh(4) | 0;
  c[c[k >> 2] >> 2] = 0;
  rh(c[f >> 2] | 0, c[k >> 2] | 0, c[g >> 2] | 0, c[j >> 2] | 0);
  sh(c[f >> 2] | 0, c[g >> 2] | 0, c[k >> 2] | 0);
  if (c[(c[f >> 2] | 0) + 44 >> 2] & 16) {
   Qi(29466, c[1840] | 0) | 0;
   b = c[1840] | 0;
   c[l >> 2] = c[g >> 2];
   $i(b, 29150, l) | 0;
   ij(c[1840] | 0) | 0;
   a : do if (c[k >> 2] | 0) {
    c[h >> 2] = c[c[k >> 2] >> 2];
    while (1) {
     if (!(c[h >> 2] | 0)) break a;
     l = c[1840] | 0;
     c[m >> 2] = c[c[h >> 2] >> 2];
     $i(l, 29169, m) | 0;
     c[h >> 2] = c[(c[h >> 2] | 0) + 8 >> 2];
    }
   } while (0);
   Vi(10, c[1840] | 0) | 0;
   ij(c[1840] | 0) | 0;
  }
  c[e >> 2] = c[k >> 2];
  m = c[e >> 2] | 0;
  i = n;
  return m | 0;
 }
 c[e >> 2] = 0;
 m = c[e >> 2] | 0;
 i = n;
 return m | 0;
}

function ug(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 h = j;
 d = j + 20 | 0;
 g = j + 16 | 0;
 e = j + 12 | 0;
 f = j + 8 | 0;
 c[d >> 2] = a;
 if (!(c[(c[d >> 2] | 0) + 100 >> 2] | 0)) {
  c[g >> 2] = $g(c[d >> 2] | 0, 21222) | 0;
  c[(c[d >> 2] | 0) + 100 >> 2] = 1;
  if (c[g >> 2] | 0) {
   a = Qf(c[g >> 2] | 0, 28235) | 0;
   c[(c[d >> 2] | 0) + 96 >> 2] = a;
   if (!(c[(c[d >> 2] | 0) + 96 >> 2] | 0)) Li(c[g >> 2] | 0);
   Cj(c[g >> 2] | 0);
  }
 }
 if (!(c[(c[d >> 2] | 0) + 44 >> 2] & 32)) if (!(c[(c[d >> 2] | 0) + 96 >> 2] | 0)) {
  i = j;
  return;
 }
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) >>> 0 >= (c[b >> 2] | 0) >>> 0) {
   d = 17;
   break;
  }
  if (!(c[(c[b + 4 >> 2] | 0) + (c[e >> 2] << 2) >> 2] | 0)) {
   d = 17;
   break;
  }
  c[f >> 2] = c[(c[b + 4 >> 2] | 0) + (c[e >> 2] << 2) >> 2];
  if (c[(c[d >> 2] | 0) + 96 >> 2] | 0) if (yf(c[d >> 2] | 0, c[f >> 2] | 0, 0) | 0) {
   g = c[(c[d >> 2] | 0) + 96 >> 2] | 0;
   k = Xa(0) | 0;
   a = c[f >> 2] | 0;
   c[h >> 2] = k;
   c[h + 4 >> 2] = a;
   $i(g, 21231, h) | 0;
  }
  if (c[(c[d >> 2] | 0) + 44 >> 2] & 32) {
   Vi(32, c[1840] | 0) | 0;
   Qi(c[f >> 2] | 0, c[1840] | 0) | 0;
  }
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 if ((d | 0) == 17) {
  i = j;
  return;
 }
}

function Uf(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 48 | 0;
 e = n + 32 | 0;
 o = n + 28 | 0;
 g = n + 24 | 0;
 f = n + 16 | 0;
 h = n + 12 | 0;
 l = n + 8 | 0;
 j = n + 4 | 0;
 k = n;
 c[e >> 2] = b;
 c[o >> 2] = d;
 Wf(f, c[e >> 2] | 0, o);
 c[h >> 2] = kh(1) | 0;
 a[c[h >> 2] >> 0] = 0;
 c[g >> 2] = 0;
 while (1) {
  if ((c[g >> 2] | 0) == (c[f >> 2] | 0)) break;
  c[l >> 2] = Sf(c[e >> 2] | 0, c[(c[f + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0;
  c[j >> 2] = c[h >> 2];
  if (c[l >> 2] | 0) if (c[(c[f + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0) {
   if (Ci(c[l >> 2] | 0, c[(c[f + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0) m = 6;
  } else m = 6; else m = 6;
  if ((m | 0) == 6) {
   m = 0;
   c[k >> 2] = c[l >> 2];
   c[l >> 2] = Uf(c[e >> 2] | 0, c[l >> 2] | 0) | 0;
   Cj(c[k >> 2] | 0);
  }
  c[h >> 2] = Ef(c[h >> 2] | 0, c[l >> 2] | 0, 20541) | 0;
  Cj(c[j >> 2] | 0);
  Cj(c[l >> 2] | 0);
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 c[g >> 2] = 0;
 while (1) {
  if ((c[g >> 2] | 0) == (c[f >> 2] | 0)) break;
  Cj(c[(c[f + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0);
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 Pg(f);
 o = (si(c[h >> 2] | 0) | 0) - 1 | 0;
 a[(c[h >> 2] | 0) + o >> 0] = 0;
 i = n;
 return c[h >> 2] | 0;
}

function Gh(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 32 | 0;
 k = n + 24 | 0;
 f = n + 20 | 0;
 l = n + 16 | 0;
 g = n + 12 | 0;
 h = n + 8 | 0;
 m = n + 4 | 0;
 j = n;
 c[n + 28 >> 2] = a;
 c[k >> 2] = b;
 c[f >> 2] = d;
 c[l >> 2] = e;
 c[h >> 2] = -1;
 c[m >> 2] = 0;
 c[j >> 2] = (c[k >> 2] | 0) >>> 0 < (c[f >> 2] | 0) >>> 0 ? -1 : 1;
 c[g >> 2] = 0;
 while (1) {
  if (!((c[m >> 2] | 0) != 0 ? 0 : (c[g >> 2] | 0) < 40)) break;
  e = _(c[g >> 2] | 0, c[j >> 2] | 0) | 0;
  c[h >> 2] = Hh(e, c[f >> 2] | 0) | 0;
  e = (c[h >> 2] | 0) - (c[k >> 2] | 0) | 0;
  d = c[h >> 2] | 0;
  if (((((c[h >> 2] | 0) - (c[k >> 2] | 0) | 0) < 0 ? 0 - e | 0 : e) | 0) <= 1) c[m >> 2] = d; else if ((_(d - (c[k >> 2] | 0) | 0, c[j >> 2] | 0) | 0) > 0) c[m >> 2] = c[k >> 2];
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 if (!(c[l >> 2] | 0)) {
  j = c[m >> 2] | 0;
  j = (j | 0) != 0;
  l = c[m >> 2] | 0;
  m = c[k >> 2] | 0;
  m = j ? l : m;
  i = n;
  return m | 0;
 }
 if (c[h >> 2] | 0) d = _((c[g >> 2] | 0) - 1 | 0, c[j >> 2] | 0) | 0; else d = 0;
 c[c[l >> 2] >> 2] = (c[m >> 2] | 0) == (d | 0) & 1;
 j = c[m >> 2] | 0;
 j = (j | 0) != 0;
 l = c[m >> 2] | 0;
 m = c[k >> 2] | 0;
 m = j ? l : m;
 i = n;
 return m | 0;
}

function Af(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 d = l + 24 | 0;
 e = l + 20 | 0;
 f = l + 16 | 0;
 g = l + 12 | 0;
 h = l + 8 | 0;
 j = l + 4 | 0;
 k = l;
 c[f >> 2] = a;
 c[g >> 2] = b;
 if (c[(c[f >> 2] | 0) + 16 >> 2] | 0) {
  c[e >> 2] = 0;
  k = c[e >> 2] | 0;
  i = l;
  return k | 0;
 }
 if (!(c[(c[f >> 2] | 0) + 8 + 4 >> 2] | 0)) {
  c[(c[f >> 2] | 0) + 16 >> 2] = 1;
  Bf(c[f >> 2] | 0);
  c[(c[f >> 2] | 0) + 16 >> 2] = 0;
  Hf(c[f >> 2] | 0);
 }
 if (!(c[(c[f >> 2] | 0) + 112 >> 2] | 0)) za(28607, 19967, 254, 20020);
 c[h >> 2] = Ef(c[g >> 2] | 0, 34049, c[(c[f >> 2] | 0) + 112 >> 2] | 0) | 0;
 a = (c[f >> 2] | 0) + 8 | 0;
 b = c[h >> 2] | 0;
 c[d >> 2] = c[a >> 2];
 c[d + 4 >> 2] = c[a + 4 >> 2];
 c[k >> 2] = fg(d, b) | 0;
 Cj(c[h >> 2] | 0);
 do if (c[k >> 2] | 0) {
  c[j >> 2] = c[c[k >> 2] >> 2];
  Cj(c[k >> 2] | 0);
 } else {
  a = (c[f >> 2] | 0) + 8 | 0;
  b = c[g >> 2] | 0;
  c[d >> 2] = c[a >> 2];
  c[d + 4 >> 2] = c[a + 4 >> 2];
  c[k >> 2] = fg(d, b) | 0;
  if (c[k >> 2] | 0) {
   c[j >> 2] = c[c[k >> 2] >> 2];
   Cj(c[k >> 2] | 0);
   break;
  } else {
   c[j >> 2] = 0;
   break;
  }
 } while (0);
 c[e >> 2] = c[j >> 2];
 k = c[e >> 2] | 0;
 i = l;
 return k | 0;
}

function Be() {
 var b = 0, e = 0;
 if (!(id() | 0)) {
  _b();
  Qi(14492, c[11] | 0) | 0;
  Qi(14492, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(14492, c[11] | 0) | 0;
  Qi(14492, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14492, c[11] | 0) | 0;
  Qi(14492, c[12] | 0) | 0;
  Yb();
  return;
 }
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 125) {
   e = 15;
   break;
  }
  ed(125, 37, 37);
  if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
   e = 10;
   break;
  }
  Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
  c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 1) | 0;
  b = c[332] | 0;
  if (c[263] | 0) {
   e = 12;
   break;
  }
  a[(c[166] | 0) + b >> 0] = 7;
  c[(c[271] | 0) + (c[332] << 2) >> 2] = 0;
  if (!(id() | 0)) {
   e = 14;
   break;
  }
 }
 if ((e | 0) == 10) {
  cc();
  Qi(14492, c[11] | 0) | 0;
  Qi(14492, c[12] | 0) | 0;
  Yb();
  return;
 } else if ((e | 0) == 12) {
  fc(b);
  return;
 } else if ((e | 0) == 14) {
  _b();
  Qi(14492, c[11] | 0) | 0;
  Qi(14492, c[12] | 0) | 0;
  Yb();
  return;
 } else if ((e | 0) == 15) {
  c[67] = (c[67] | 0) + 1;
  return;
 }
}

function Sc(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 32 | 0;
 g = n + 20 | 0;
 h = n + 16 | 0;
 o = n + 12 | 0;
 j = n + 8 | 0;
 k = n + 4 | 0;
 m = n;
 l = n + 24 | 0;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[o >> 2] = e;
 c[j >> 2] = f;
 c[k >> 2] = c[o >> 2];
 if ((c[g >> 2] | 0) < 0) {
  if ((c[k >> 2] | 0) == (c[14] | 0)) xb();
  a[(c[h >> 2] | 0) + (c[k >> 2] | 0) >> 0] = 45;
  c[k >> 2] = (c[k >> 2] | 0) + 1;
  c[g >> 2] = 0 - (c[g >> 2] | 0);
 }
 c[m >> 2] = c[k >> 2];
 do {
  if ((c[k >> 2] | 0) == (c[14] | 0)) xb();
  a[(c[h >> 2] | 0) + (c[k >> 2] | 0) >> 0] = 48 + ((c[g >> 2] | 0) % 10 | 0);
  c[k >> 2] = (c[k >> 2] | 0) + 1;
  c[g >> 2] = (c[g >> 2] | 0) / 10 | 0;
 } while ((c[g >> 2] | 0) == 0 ^ 1);
 c[c[j >> 2] >> 2] = c[k >> 2];
 c[k >> 2] = (c[k >> 2] | 0) - 1;
 while (1) {
  if ((c[m >> 2] | 0) >= (c[k >> 2] | 0)) break;
  a[l >> 0] = a[(c[h >> 2] | 0) + (c[m >> 2] | 0) >> 0] | 0;
  a[(c[h >> 2] | 0) + (c[m >> 2] | 0) >> 0] = a[(c[h >> 2] | 0) + (c[k >> 2] | 0) >> 0] | 0;
  a[(c[h >> 2] | 0) + (c[k >> 2] | 0) >> 0] = a[l >> 0] | 0;
  c[k >> 2] = (c[k >> 2] | 0) - 1;
  c[m >> 2] = (c[m >> 2] | 0) + 1;
 }
 i = n;
 return;
}

function eh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 16 | 0;
 e = j + 12 | 0;
 f = j + 8 | 0;
 g = j + 4 | 0;
 h = j;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[g >> 2] = d;
 c[h >> 2] = 0;
 while (1) {
  if ((c[h >> 2] | 0) >>> 0 >= (c[(c[e >> 2] | 0) + 4156 >> 2] | 0) >>> 0) {
   a = 7;
   break;
  }
  if ((c[f >> 2] | 0) != 0 ? (c[(c[(c[e >> 2] | 0) + 4152 >> 2] | 0) + (c[h >> 2] << 3) >> 2] | 0) != 0 : 0) if (!(Ci(c[(c[(c[e >> 2] | 0) + 4152 >> 2] | 0) + (c[h >> 2] << 3) >> 2] | 0, c[f >> 2] | 0) | 0)) {
   a = 5;
   break;
  }
  c[h >> 2] = (c[h >> 2] | 0) + 1;
 }
 if ((a | 0) == 5) {
  c[(c[(c[e >> 2] | 0) + 4152 >> 2] | 0) + (c[h >> 2] << 3) + 4 >> 2] = c[g >> 2];
  i = j;
  return;
 } else if ((a | 0) == 7) {
  h = (c[e >> 2] | 0) + 4156 | 0;
  c[h >> 2] = (c[h >> 2] | 0) + 1;
  h = mh(c[(c[e >> 2] | 0) + 4152 >> 2] | 0, c[(c[e >> 2] | 0) + 4156 >> 2] << 3) | 0;
  c[(c[e >> 2] | 0) + 4152 >> 2] = h;
  h = nh(c[f >> 2] | 0) | 0;
  c[(c[(c[e >> 2] | 0) + 4152 >> 2] | 0) + ((c[(c[e >> 2] | 0) + 4156 >> 2] | 0) - 1 << 3) >> 2] = h;
  c[(c[(c[e >> 2] | 0) + 4152 >> 2] | 0) + ((c[(c[e >> 2] | 0) + 4156 >> 2] | 0) - 1 << 3) + 4 >> 2] = c[g >> 2];
  i = j;
  return;
 }
}

function lg(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 32 | 0;
 d = j + 16 | 0;
 e = j + 12 | 0;
 f = j + 8 | 0;
 h = j + 4 | 0;
 g = j;
 c[d >> 2] = b;
 c[f >> 2] = 75;
 c[h >> 2] = 0;
 c[g >> 2] = kh(c[f >> 2] | 0) | 0;
 Zi(c[d >> 2] | 0);
 while (1) {
  b = nj(c[d >> 2] | 0) | 0;
  c[e >> 2] = b;
  if (!((b | 0) != -1 & (c[e >> 2] | 0) != 10 & (c[e >> 2] | 0) != 13)) break;
  a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] = c[e >> 2];
  c[h >> 2] = (c[h >> 2] | 0) + 1;
  if ((c[h >> 2] | 0) != (c[f >> 2] | 0)) continue;
  c[f >> 2] = (c[f >> 2] | 0) + 75;
  c[g >> 2] = mh(c[g >> 2] | 0, c[f >> 2] | 0) | 0;
 }
 if ((c[h >> 2] | 0) == 0 & (c[e >> 2] | 0) == -1) {
  Cj(c[g >> 2] | 0);
  c[g >> 2] = 0;
  h = c[d >> 2] | 0;
  oj(h);
  h = c[g >> 2] | 0;
  i = j;
  return h | 0;
 }
 a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] = 0;
 if ((c[e >> 2] | 0) != 13) {
  h = c[d >> 2] | 0;
  oj(h);
  h = c[g >> 2] | 0;
  i = j;
  return h | 0;
 }
 c[e >> 2] = nj(c[d >> 2] | 0) | 0;
 if ((c[e >> 2] | 0) == 10) {
  h = c[d >> 2] | 0;
  oj(h);
  h = c[g >> 2] | 0;
  i = j;
  return h | 0;
 }
 jj(c[e >> 2] | 0, c[d >> 2] | 0) | 0;
 h = c[d >> 2] | 0;
 oj(h);
 h = c[g >> 2] | 0;
 i = j;
 return h | 0;
}

function zg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 112 | 0;
 e = n + 96 | 0;
 f = n + 92 | 0;
 l = n + 88 | 0;
 h = n + 84 | 0;
 j = n + 80 | 0;
 g = n + 76 | 0;
 k = n;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[l >> 2] = 0;
 a : do if (yf(c[e >> 2] | 0, c[f >> 2] | 0, 1) | 0) c[l >> 2] = nh(c[f >> 2] | 0) | 0; else {
  b = c[e >> 2] | 0;
  c[g >> 2] = mg(b, Ka(21239) | 0) | 0;
  while (1) {
   if (!((c[l >> 2] | 0) != 0 ? 0 : (c[g >> 2] | 0) != 0)) break a;
   if (!(a[c[g >> 2] >> 0] | 0)) c[g >> 2] = 34049;
   c[h >> 2] = Ef(c[g >> 2] | 0, 29173, c[f >> 2] | 0) | 0;
   if (!(Uh(c[h >> 2] | 0, k) | 0)) if (c[k + 12 >> 2] & 73) if ((c[k + 12 >> 2] & 61440 | 0) == 16384) m = 11; else c[l >> 2] = c[h >> 2]; else m = 11; else m = 11;
   if ((m | 0) == 11) {
    m = 0;
    Cj(c[h >> 2] | 0);
   }
   c[g >> 2] = mg(c[e >> 2] | 0, 0) | 0;
  }
 } while (0);
 if (!(c[l >> 2] | 0)) c[l >> 2] = Ef(34049, 29173, c[f >> 2] | 0) | 0;
 m = c[e >> 2] | 0;
 c[h >> 2] = Dg(m, Cg(c[e >> 2] | 0, c[l >> 2] | 0) | 0) | 0;
 Cj(c[l >> 2] | 0);
 c[j >> 2] = gh(c[h >> 2] | 0) | 0;
 Cj(c[h >> 2] | 0);
 i = n;
 return c[j >> 2] | 0;
}
function Ge() {
 if (!(c[697] | 0)) {
  Qi(15081, c[11] | 0) | 0;
  Qi(15081, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (!(id() | 0)) {
  _b();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 ed(125, 37, 37);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  cc();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (ye() | 0) return;
 if (!(id() | 0)) {
  _b();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(15126, c[11] | 0) | 0;
  Qi(15126, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 Hd();
 c[174] = 1;
 if ((c[179] | 0) <= 0) return;
 c[698] = c[179];
 do {
  c[698] = (c[698] | 0) - 1;
  c[172] = c[(c[124] | 0) + (c[698] << 2) >> 2];
  ne(c[332] | 0);
  Id();
 } while ((c[698] | 0) == 0 ^ 1);
 return;
}

function he() {
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(c[323] | 0, 1);
  return;
 }
 c[368] = 0;
 c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
 c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
 c[364] = 0;
 while (1) {
  if ((c[365] | 0) >= (c[366] | 0)) break;
  c[365] = (c[365] | 0) + 1;
  if ((d[(c[64] | 0) + ((c[365] | 0) - 1) >> 0] | 0 | 0) != 123) {
   if ((d[(c[64] | 0) + ((c[365] | 0) - 1) >> 0] | 0 | 0) != 125) {
    c[368] = (c[368] | 0) + 1;
    continue;
   }
   if ((c[364] | 0) <= 0) continue;
   c[364] = (c[364] | 0) - 1;
   continue;
  }
  c[364] = (c[364] | 0) + 1;
  if ((c[364] | 0) != 1) continue;
  if ((c[365] | 0) >= (c[366] | 0)) continue;
  if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) != 92) continue;
  c[365] = (c[365] | 0) + 1;
  while (1) {
   if (!((c[365] | 0) < (c[366] | 0) ? (c[364] | 0) > 0 : 0)) break;
   if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 125) c[364] = (c[364] | 0) - 1; else if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 123) c[364] = (c[364] | 0) + 1;
   c[365] = (c[365] | 0) + 1;
  }
  c[368] = (c[368] | 0) + 1;
 }
 Cd(c[368] | 0, 0);
 return;
}

function Ad(a) {
 a = a | 0;
 var b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f + 4 | 0;
 e = f;
 c[b >> 2] = a;
 c[368] = 0;
 c[369] = c[345];
 while (1) {
  if ((c[369] | 0) >= (c[273] | 0)) break;
  if ((c[368] | 0) >= (c[b >> 2] | 0)) break;
  c[369] = (c[369] | 0) + 1;
  a : do if ((d[(c[17] | 0) + ((c[369] | 0) - 1) >> 0] | 0 | 0) == 123) {
   c[352] = (c[352] | 0) + 1;
   if ((c[352] | 0) == 1) if ((c[369] | 0) < (c[273] | 0)) if ((d[(c[17] | 0) + (c[369] | 0) >> 0] | 0 | 0) == 92) {
    c[369] = (c[369] | 0) + 1;
    while (1) {
     if (!((c[369] | 0) < (c[273] | 0) ? (c[352] | 0) > 0 : 0)) break a;
     if ((d[(c[17] | 0) + (c[369] | 0) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; else if ((d[(c[17] | 0) + (c[369] | 0) >> 0] | 0 | 0) == 123) c[352] = (c[352] | 0) + 1;
     c[369] = (c[369] | 0) + 1;
    }
   }
  } else if ((d[(c[17] | 0) + ((c[369] | 0) - 1) >> 0] | 0 | 0) == 125) c[352] = (c[352] | 0) - 1; while (0);
  c[368] = (c[368] | 0) + 1;
 }
 if ((c[368] | 0) < (c[b >> 2] | 0)) {
  c[e >> 2] = 0;
  a = c[e >> 2] | 0;
  i = f;
  return a | 0;
 } else {
  c[e >> 2] = 1;
  a = c[e >> 2] | 0;
  i = f;
  return a | 0;
 }
 return 0;
}

function uf(a, b, d, e, f, g, h) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 r = i;
 i = i + 48 | 0;
 j = r + 32 | 0;
 k = r + 28 | 0;
 l = r + 24 | 0;
 m = r + 20 | 0;
 n = r + 16 | 0;
 o = r + 12 | 0;
 s = r + 8 | 0;
 p = r + 4 | 0;
 q = r;
 c[j >> 2] = a;
 c[k >> 2] = b;
 c[l >> 2] = d;
 c[m >> 2] = e;
 c[n >> 2] = f;
 c[o >> 2] = g;
 c[s >> 2] = h;
 if (c[s >> 2] | 0) {
  i = r;
  return;
 }
 if (!(c[(c[j >> 2] | 0) + 132 + ((c[m >> 2] | 0) * 68 | 0) + 32 >> 2] | 0)) {
  i = r;
  return;
 }
 c[p >> 2] = c[(c[j >> 2] | 0) + 132 + ((c[m >> 2] | 0) * 68 | 0) + 32 >> 2];
 while (1) {
  if (!(c[c[p >> 2] >> 2] | 0)) break;
  c[q >> 2] = Df(c[n >> 2] | 0, c[c[p >> 2] >> 2] | 0) | 0;
  c[(c[c[k >> 2] >> 2] | 0) + (c[c[l >> 2] >> 2] << 2) >> 2] = c[q >> 2];
  s = c[l >> 2] | 0;
  c[s >> 2] = (c[s >> 2] | 0) + 1;
  s = mh(c[c[k >> 2] >> 2] | 0, (c[c[l >> 2] >> 2] | 0) + 1 << 2) | 0;
  c[c[k >> 2] >> 2] = s;
  if (c[o >> 2] | 0) xf(c[j >> 2] | 0, c[k >> 2] | 0, c[l >> 2] | 0, c[q >> 2] | 0);
  c[p >> 2] = (c[p >> 2] | 0) + 4;
 }
 i = r;
 return;
}

function pj(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0, s = 0;
 s = i;
 i = i + 224 | 0;
 o = s + 80 | 0;
 r = s + 96 | 0;
 q = s;
 p = s + 136 | 0;
 f = r;
 g = f + 40 | 0;
 do {
  c[f >> 2] = 0;
  f = f + 4 | 0;
 } while ((f | 0) < (g | 0));
 c[o >> 2] = c[e >> 2];
 if ((wj(0, d, o, q, r) | 0) < 0) e = -1; else {
  if ((c[b + 76 >> 2] | 0) > -1) m = cj(b) | 0; else m = 0;
  e = c[b >> 2] | 0;
  n = e & 32;
  if ((a[b + 74 >> 0] | 0) < 1) c[b >> 2] = e & -33;
  e = b + 48 | 0;
  if (!(c[e >> 2] | 0)) {
   g = b + 44 | 0;
   h = c[g >> 2] | 0;
   c[g >> 2] = p;
   j = b + 28 | 0;
   c[j >> 2] = p;
   k = b + 20 | 0;
   c[k >> 2] = p;
   c[e >> 2] = 80;
   l = b + 16 | 0;
   c[l >> 2] = p + 80;
   f = wj(b, d, o, q, r) | 0;
   if (h) {
    cb[c[b + 36 >> 2] & 7](b, 0, 0) | 0;
    f = (c[k >> 2] | 0) == 0 ? -1 : f;
    c[g >> 2] = h;
    c[e >> 2] = 0;
    c[l >> 2] = 0;
    c[j >> 2] = 0;
    c[k >> 2] = 0;
   }
  } else f = wj(b, d, o, q, r) | 0;
  e = c[b >> 2] | 0;
  c[b >> 2] = e | n;
  if (m) dj(b);
  e = (e & 32 | 0) == 0 ? f : -1;
 }
 i = s;
 return e | 0;
}

function Ce() {
 if (!(c[697] | 0)) {
  Qi(14501, c[11] | 0) | 0;
  Qi(14501, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (!(id() | 0)) {
  _b();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 ed(125, 37, 37);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  cc();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (ye() | 0) return;
 if (!(id() | 0)) {
  _b();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(14546, c[11] | 0) | 0;
  Qi(14546, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 Hd();
 c[174] = 1;
 c[698] = 0;
 while (1) {
  if ((c[698] | 0) >= (c[179] | 0)) break;
  c[172] = c[(c[124] | 0) + (c[698] << 2) >> 2];
  ne(c[332] | 0);
  Id();
  c[698] = (c[698] | 0) + 1;
 }
 return;
}

function fi(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 16 | 0;
 g = k;
 a : do if (!e) g = 0; else {
  do if (f) {
   j = (b | 0) == 0 ? g : b;
   g = a[e >> 0] | 0;
   b = g & 255;
   if (g << 24 >> 24 > -1) {
    c[j >> 2] = b;
    g = g << 24 >> 24 != 0 & 1;
    break a;
   }
   g = b + -194 | 0;
   if (g >>> 0 <= 50) {
    b = e + 1 | 0;
    h = c[7144 + (g << 2) >> 2] | 0;
    if (f >>> 0 < 4) if (h & -2147483648 >>> ((f * 6 | 0) + -6 | 0)) break;
    g = d[b >> 0] | 0;
    f = g >>> 3;
    if ((f + -16 | f + (h >> 26)) >>> 0 <= 7) {
     g = g + -128 | h << 6;
     if ((g | 0) >= 0) {
      c[j >> 2] = g;
      g = 2;
      break a;
     }
     b = d[e + 2 >> 0] | 0;
     if ((b & 192 | 0) == 128) {
      b = b + -128 | g << 6;
      if ((b | 0) >= 0) {
       c[j >> 2] = b;
       g = 3;
       break a;
      }
      g = d[e + 3 >> 0] | 0;
      if ((g & 192 | 0) == 128) {
       c[j >> 2] = g + -128 | b << 6;
       g = 4;
       break a;
      }
     }
    }
   }
  } while (0);
  c[(Hi() | 0) >> 2] = 84;
  g = -1;
 } while (0);
 i = k;
 return g | 0;
}

function Mc(a, b, e, f) {
 a = a | 0;
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 32 | 0;
 g = n + 24 | 0;
 h = n + 20 | 0;
 j = n + 16 | 0;
 o = n + 12 | 0;
 m = n + 8 | 0;
 k = n + 4 | 0;
 l = n;
 c[g >> 2] = a;
 c[h >> 2] = b;
 c[j >> 2] = e;
 c[o >> 2] = f;
 if (((c[(c[63] | 0) + ((c[g >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[g >> 2] << 2) >> 2] | 0) | 0) != (c[o >> 2] | 0)) {
  c[m >> 2] = 0;
  o = c[m >> 2] | 0;
  i = n;
  return o | 0;
 }
 c[k >> 2] = c[j >> 2];
 c[l >> 2] = c[(c[63] | 0) + (c[g >> 2] << 2) >> 2];
 while (1) {
  if ((c[l >> 2] | 0) >= (c[(c[63] | 0) + ((c[g >> 2] | 0) + 1 << 2) >> 2] | 0)) {
   g = 8;
   break;
  }
  if ((d[(c[64] | 0) + (c[l >> 2] | 0) >> 0] | 0 | 0) != (d[(c[h >> 2] | 0) + (c[k >> 2] | 0) >> 0] | 0 | 0)) {
   g = 6;
   break;
  }
  c[k >> 2] = (c[k >> 2] | 0) + 1;
  c[l >> 2] = (c[l >> 2] | 0) + 1;
 }
 if ((g | 0) == 6) {
  c[m >> 2] = 0;
  o = c[m >> 2] | 0;
  i = n;
  return o | 0;
 } else if ((g | 0) == 8) {
  c[m >> 2] = 1;
  o = c[m >> 2] | 0;
  i = n;
  return o | 0;
 }
 return 0;
}

function _f(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 d = l + 24 | 0;
 e = l + 20 | 0;
 f = l + 16 | 0;
 j = l + 12 | 0;
 k = l + 8 | 0;
 g = l + 4 | 0;
 h = l;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[k >> 2] = xh(c[f >> 2] | 0) | 0;
 if (!(c[(c[e >> 2] | 0) + 64 + 4 >> 2] | 0)) $f(c[e >> 2] | 0);
 b = (c[e >> 2] | 0) + 64 | 0;
 a = c[f >> 2] | 0;
 c[d >> 2] = c[b >> 2];
 c[d + 4 >> 2] = c[b + 4 >> 2];
 c[j >> 2] = fg(d, a) | 0;
 if ((c[j >> 2] | 0) == 0 & (c[k >> 2] | 0) != 0) {
  c[g >> 2] = Kg(c[f >> 2] | 0) | 0;
  b = (c[e >> 2] | 0) + 64 | 0;
  a = c[g >> 2] | 0;
  c[d >> 2] = c[b >> 2];
  c[d + 4 >> 2] = c[b + 4 >> 2];
  c[j >> 2] = fg(d, a) | 0;
  Cj(c[g >> 2] | 0);
 }
 if (!((c[j >> 2] | 0) != 0 & (c[k >> 2] | 0) != 0)) {
  k = c[j >> 2] | 0;
  i = l;
  return k | 0;
 }
 c[h >> 2] = c[j >> 2];
 while (1) {
  if (!(c[c[h >> 2] >> 2] | 0)) break;
  a = wh(c[c[h >> 2] >> 2] | 0, c[k >> 2] | 0) | 0;
  c[c[h >> 2] >> 2] = a;
  c[h >> 2] = (c[h >> 2] | 0) + 4;
 }
 k = c[j >> 2] | 0;
 i = l;
 return k | 0;
}

function Bc(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 h = j + 8 | 0;
 g = j;
 f = j + 16 | 0;
 k = j + 20 | 0;
 c[f >> 2] = b;
 a[k >> 0] = e;
 switch (d[k >> 0] | 0 | 0) {
 case 0:
  {
   k = c[11] | 0;
   c[g >> 2] = c[f >> 2];
   c[g + 4 >> 2] = 10939;
   $i(k, 10933, g) | 0;
   k = c[12] | 0;
   c[h >> 2] = c[f >> 2];
   c[h + 4 >> 2] = 10939;
   $i(k, 10933, h) | 0;
   i = j;
   return;
  }
 case 1:
  {
   Vi(34, c[11] | 0) | 0;
   Vi(34, c[12] | 0) | 0;
   Ab(c[f >> 2] | 0);
   Qi(10962, c[11] | 0) | 0;
   Qi(10962, c[12] | 0) | 0;
   i = j;
   return;
  }
 case 2:
  {
   Vi(96, c[11] | 0) | 0;
   Vi(96, c[12] | 0) | 0;
   Ab(c[(c[167] | 0) + (c[f >> 2] << 2) >> 2] | 0);
   Qi(10984, c[11] | 0) | 0;
   Qi(10984, c[12] | 0) | 0;
   i = j;
   return;
  }
 case 3:
  {
   Vi(96, c[11] | 0) | 0;
   Vi(96, c[12] | 0) | 0;
   Ab(c[f >> 2] | 0);
   Qi(11008, c[11] | 0) | 0;
   Qi(11008, c[12] | 0) | 0;
   i = j;
   return;
  }
 case 4:
  {
   zc();
   i = j;
   return;
  }
 default:
  {
   Ac();
   i = j;
   return;
  }
 }
}

function ti(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, i = 0;
 h = d & 255;
 f = (e | 0) != 0;
 a : do if (f & (b & 3 | 0) != 0) {
  g = d & 255;
  while (1) {
   if ((a[b >> 0] | 0) == g << 24 >> 24) {
    i = 6;
    break a;
   }
   b = b + 1 | 0;
   e = e + -1 | 0;
   f = (e | 0) != 0;
   if (!(f & (b & 3 | 0) != 0)) {
    i = 5;
    break;
   }
  }
 } else i = 5; while (0);
 if ((i | 0) == 5) if (f) i = 6; else e = 0;
 b : do if ((i | 0) == 6) {
  g = d & 255;
  if ((a[b >> 0] | 0) != g << 24 >> 24) {
   f = _(h, 16843009) | 0;
   c : do if (e >>> 0 > 3) while (1) {
    h = c[b >> 2] ^ f;
    if ((h & -2139062144 ^ -2139062144) & h + -16843009) break;
    b = b + 4 | 0;
    e = e + -4 | 0;
    if (e >>> 0 <= 3) {
     i = 11;
     break c;
    }
   } else i = 11; while (0);
   if ((i | 0) == 11) if (!e) {
    e = 0;
    break;
   }
   while (1) {
    if ((a[b >> 0] | 0) == g << 24 >> 24) break b;
    b = b + 1 | 0;
    e = e + -1 | 0;
    if (!e) {
     e = 0;
     break;
    }
   }
  }
 } while (0);
 return ((e | 0) != 0 ? b : 0) | 0;
}

function ac(a) {
 a = a | 0;
 var b = 0, e = 0;
 b = i;
 i = i + 16 | 0;
 e = b;
 c[e >> 2] = a;
 do switch (d[(c[166] | 0) + (c[e >> 2] | 0) >> 0] | 0 | 0) {
 case 0:
  {
   Qi(10086, c[11] | 0) | 0;
   Qi(10086, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 1:
  {
   Qi(10095, c[11] | 0) | 0;
   Qi(10095, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 2:
  {
   Qi(10110, c[11] | 0) | 0;
   Qi(10110, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 3:
  {
   Qi(10126, c[11] | 0) | 0;
   Qi(10126, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 4:
  {
   Qi(10141, c[11] | 0) | 0;
   Qi(10141, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 5:
  {
   Qi(10147, c[11] | 0) | 0;
   Qi(10147, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 6:
  {
   Qi(10170, c[11] | 0) | 0;
   Qi(10170, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 7:
  {
   Qi(10192, c[11] | 0) | 0;
   Qi(10192, c[12] | 0) | 0;
   i = b;
   return;
  }
 case 8:
  {
   Qi(10216, c[11] | 0) | 0;
   Qi(10216, c[12] | 0) | 0;
   i = b;
   return;
  }
 default:
  {
   $b();
   i = b;
   return;
  }
 } while (0);
}

function Tf(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 48 | 0;
 e = n + 32 | 0;
 o = n + 28 | 0;
 h = n + 24 | 0;
 f = n + 20 | 0;
 j = n + 16 | 0;
 m = n + 12 | 0;
 k = n + 8 | 0;
 l = n + 4 | 0;
 g = n;
 c[e >> 2] = b;
 c[o >> 2] = d;
 c[m >> 2] = bh(c[e >> 2] | 0, c[o >> 2] | 0) | 0;
 c[k >> 2] = kh(1) | 0;
 a[c[k >> 2] >> 0] = 0;
 c[f >> 2] = mg(c[e >> 2] | 0, c[m >> 2] | 0) | 0;
 while (1) {
  b = c[k >> 2] | 0;
  if (!(c[f >> 2] | 0)) break;
  c[l >> 2] = b;
  c[g >> 2] = Uf(c[e >> 2] | 0, c[f >> 2] | 0) | 0;
  c[k >> 2] = Ef(c[k >> 2] | 0, c[g >> 2] | 0, 20541) | 0;
  Cj(c[g >> 2] | 0);
  Cj(c[l >> 2] | 0);
  c[f >> 2] = mg(c[e >> 2] | 0, 0) | 0;
 }
 c[j >> 2] = si(b) | 0;
 if (c[j >> 2] | 0) a[(c[k >> 2] | 0) + ((c[j >> 2] | 0) - 1) >> 0] = 0;
 Cj(c[m >> 2] | 0);
 c[h >> 2] = Vf(c[e >> 2] | 0, c[k >> 2] | 0) | 0;
 if ((c[h >> 2] | 0) == (c[k >> 2] | 0)) {
  o = c[h >> 2] | 0;
  i = n;
  return o | 0;
 }
 Cj(c[k >> 2] | 0);
 o = c[h >> 2] | 0;
 i = n;
 return o | 0;
}

function Nc(a, b) {
 a = a | 0;
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 g = h;
 c[e >> 2] = a;
 c[f >> 2] = b;
 if (((c[(c[63] | 0) + ((c[e >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[e >> 2] << 2) >> 2] | 0) | 0) != ((c[(c[63] | 0) + ((c[f >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[f >> 2] << 2) >> 2] | 0) | 0)) {
  c[g >> 2] = 0;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 }
 c[260] = c[(c[63] | 0) + (c[e >> 2] << 2) >> 2];
 c[261] = c[(c[63] | 0) + (c[f >> 2] << 2) >> 2];
 while (1) {
  if ((c[260] | 0) >= (c[(c[63] | 0) + ((c[e >> 2] | 0) + 1 << 2) >> 2] | 0)) {
   e = 8;
   break;
  }
  if ((d[(c[64] | 0) + (c[260] | 0) >> 0] | 0 | 0) != (d[(c[64] | 0) + (c[261] | 0) >> 0] | 0 | 0)) {
   e = 6;
   break;
  }
  c[260] = (c[260] | 0) + 1;
  c[261] = (c[261] | 0) + 1;
 }
 if ((e | 0) == 6) {
  c[g >> 2] = 0;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 } else if ((e | 0) == 8) {
  c[g >> 2] = 1;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function Ei(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0;
 g = d;
 do if (!((g ^ b) & 3)) {
  f = (e | 0) != 0;
  a : do if (f & (g & 3 | 0) != 0) while (1) {
   g = a[d >> 0] | 0;
   a[b >> 0] = g;
   if (!(g << 24 >> 24)) break a;
   e = e + -1 | 0;
   d = d + 1 | 0;
   b = b + 1 | 0;
   f = (e | 0) != 0;
   if (!(f & (d & 3 | 0) != 0)) {
    h = 5;
    break;
   }
  } else h = 5; while (0);
  if ((h | 0) == 5) if (!f) {
   e = 0;
   break;
  }
  if (a[d >> 0] | 0) {
   b : do if (e >>> 0 > 3) do {
    f = c[d >> 2] | 0;
    if ((f & -2139062144 ^ -2139062144) & f + -16843009) break b;
    c[b >> 2] = f;
    e = e + -4 | 0;
    d = d + 4 | 0;
    b = b + 4 | 0;
   } while (e >>> 0 > 3); while (0);
   h = 11;
  }
 } else h = 11; while (0);
 c : do if ((h | 0) == 11) if (!e) e = 0; else while (1) {
  h = a[d >> 0] | 0;
  a[b >> 0] = h;
  if (!(h << 24 >> 24)) break c;
  e = e + -1 | 0;
  b = b + 1 | 0;
  if (!e) {
   e = 0;
   break;
  } else d = d + 1 | 0;
 } while (0);
 Jj(b | 0, 0, e | 0) | 0;
 return b | 0;
}

function Uc(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = b;
 c[273] = 0;
 c[274] = c[(c[63] | 0) + (c[d >> 2] << 2) >> 2];
 c[275] = c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2];
 while (1) {
  if ((c[274] | 0) >= (c[275] | 0)) break;
  a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[274] | 0) >> 0] | 0;
  c[273] = (c[273] | 0) + 1;
  c[274] = (c[274] | 0) + 1;
 }
 c[270] = Qc(c[17] | 0, 0, (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0) | 0, 9, 0) | 0;
 c[276] = c[263];
 Oc(c[17] | 0, 0, (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0) | 0);
 c[272] = Qc(c[17] | 0, 0, (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0) | 0, 10, 0) | 0;
 if (c[263] | 0) {
  c[e >> 2] = 1;
  b = c[e >> 2] | 0;
  i = f;
  return b | 0;
 } else {
  c[e >> 2] = 0;
  b = c[e >> 2] | 0;
  i = f;
  return b | 0;
 }
 return 0;
}

function kj(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 m = i;
 i = i + 48 | 0;
 h = m + 16 | 0;
 g = m;
 f = m + 32 | 0;
 c[f >> 2] = d;
 j = f + 4 | 0;
 l = b + 48 | 0;
 n = c[l >> 2] | 0;
 c[j >> 2] = e - ((n | 0) != 0 & 1);
 k = b + 44 | 0;
 c[f + 8 >> 2] = c[k >> 2];
 c[f + 12 >> 2] = n;
 if (!(c[1841] | 0)) {
  c[h >> 2] = c[b + 60 >> 2];
  c[h + 4 >> 2] = f;
  c[h + 8 >> 2] = 2;
  f = rj($a(145, h | 0) | 0) | 0;
 } else {
  na(4, b | 0);
  c[g >> 2] = c[b + 60 >> 2];
  c[g + 4 >> 2] = f;
  c[g + 8 >> 2] = 2;
  f = rj($a(145, g | 0) | 0) | 0;
  ja(0);
 }
 if ((f | 0) < 1) {
  c[b >> 2] = c[b >> 2] | f & 48 ^ 16;
  c[b + 8 >> 2] = 0;
  c[b + 4 >> 2] = 0;
 } else {
  j = c[j >> 2] | 0;
  if (f >>> 0 > j >>> 0) {
   h = c[k >> 2] | 0;
   g = b + 4 | 0;
   c[g >> 2] = h;
   c[b + 8 >> 2] = h + (f - j);
   if (!(c[l >> 2] | 0)) f = e; else {
    c[g >> 2] = h + 1;
    a[d + (e + -1) >> 0] = a[h >> 0] | 0;
    f = e;
   }
  }
 }
 i = m;
 return f | 0;
}

function Tg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 g = k + 20 | 0;
 h = k + 16 | 0;
 j = k + 12 | 0;
 f = k + 8 | 0;
 e = k + 4 | 0;
 d = k;
 c[g >> 2] = a;
 c[h >> 2] = b;
 if (c[(c[h >> 2] | 0) + 4 >> 2] | 0) {
  i = k;
  return;
 }
 c[j >> 2] = 0;
 c[f >> 2] = c[c[g >> 2] >> 2];
 while (1) {
  a = c[f >> 2] | 0;
  if (!(c[(c[f >> 2] | 0) + 4 >> 2] | 0)) break;
  c[j >> 2] = a;
  c[f >> 2] = c[(c[f >> 2] | 0) + 8 >> 2];
 }
 do if ((a | 0) != (c[h >> 2] | 0)) {
  c[d >> 2] = c[(c[h >> 2] | 0) + 8 >> 2];
  c[e >> 2] = c[f >> 2];
  while (1) {
   if ((c[(c[e >> 2] | 0) + 8 >> 2] | 0) == (c[h >> 2] | 0)) break;
   c[e >> 2] = c[(c[e >> 2] | 0) + 8 >> 2];
  }
  c[(c[e >> 2] | 0) + 8 >> 2] = c[d >> 2];
  c[(c[h >> 2] | 0) + 8 >> 2] = c[f >> 2];
  a = c[h >> 2] | 0;
  if (c[j >> 2] | 0) {
   c[(c[j >> 2] | 0) + 8 >> 2] = a;
   break;
  } else {
   c[c[g >> 2] >> 2] = a;
   break;
  }
 } while (0);
 c[(c[h >> 2] | 0) + 4 >> 2] = 1;
 i = k;
 return;
}

function ze() {
 if (!(c[697] | 0)) {
  Qi(14439, c[11] | 0) | 0;
  Qi(14439, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (!(id() | 0)) {
  _b();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 123) {
  dc();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 }
 c[67] = (c[67] | 0) + 1;
 if (!(id() | 0)) {
  _b();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 }
 ed(125, 37, 37);
 if ((d[9125] | 0 | 0) != 3) if ((d[9125] | 0 | 0) != 1) {
  cc();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 }
 if (ye() | 0) return;
 if (!(id() | 0)) {
  _b();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 125) {
  ec();
  Qi(14484, c[11] | 0) | 0;
  Qi(14484, c[12] | 0) | 0;
  Yb();
  return;
 } else {
  c[67] = (c[67] | 0) + 1;
  Hd();
  c[174] = 0;
  ne(c[332] | 0);
  Id();
  return;
 }
}

function ed(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 16 | 0;
 g = k + 2 | 0;
 h = k + 1 | 0;
 j = k;
 a[g >> 0] = b;
 a[h >> 0] = e;
 a[j >> 0] = f;
 c[66] = c[67];
 a : do if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 3) while (1) {
  if ((d[9126 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) break a;
  if ((c[67] | 0) >= (c[21] | 0)) break a;
  c[67] = (c[67] | 0) + 1;
 } while (0);
 if (!((c[67] | 0) - (c[66] | 0) | 0)) {
  a[9125] = 0;
  i = k;
  return;
 }
 if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((c[67] | 0) != (c[21] | 0)) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[g >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[h >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[j >> 0] | 0 | 0)) {
   a[9125] = 2;
   i = k;
   return;
  }
  a[9125] = 1;
  i = k;
  return;
 }
 a[9125] = 3;
 i = k;
 return;
}

function zb(a, b) {
 a = a | 0;
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 k = l + 8 | 0;
 j = l;
 e = l + 28 | 0;
 f = l + 24 | 0;
 h = l + 20 | 0;
 g = l + 16 | 0;
 c[e >> 2] = a;
 c[f >> 2] = b;
 if ((c[f >> 2] | 0) >= 0) if ((c[f >> 2] | 0) < ((c[22] | 0) + 3 | 0)) if ((c[f >> 2] | 0) < (c[23] | 0)) {
  c[h >> 2] = c[(c[63] | 0) + (c[f >> 2] << 2) >> 2];
  c[g >> 2] = (c[(c[63] | 0) + ((c[f >> 2] | 0) + 1 << 2) >> 2] | 0) - 1;
  if ((c[h >> 2] | 0) > (c[g >> 2] | 0)) {
   i = l;
   return;
  }
  do {
   Vi(d[8869 + (d[(c[64] | 0) + (c[h >> 2] | 0) >> 0] | 0) >> 0] | 0, c[e >> 2] | 0) | 0;
   k = c[h >> 2] | 0;
   c[h >> 2] = k + 1;
  } while ((k | 0) < (c[g >> 2] | 0));
  i = l;
  return;
 }
 l = c[11] | 0;
 b = c[f >> 2] | 0;
 c[j >> 2] = 9596;
 c[j + 4 >> 2] = b;
 $i(l, 9590, j) | 0;
 l = c[12] | 0;
 j = c[f >> 2] | 0;
 c[k >> 2] = 9596;
 c[k + 4 >> 2] = j;
 $i(l, 9590, k) | 0;
 wb();
 xa(96, 1);
}

function Qg(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 32 | 0;
 b = j + 28 | 0;
 d = j + 24 | 0;
 h = j + 16 | 0;
 e = j + 8 | 0;
 g = j + 4 | 0;
 f = j;
 c[b >> 2] = a;
 Rg(h);
 c[d >> 2] = 0;
 while (1) {
  if ((c[d >> 2] | 0) >>> 0 >= (c[c[b >> 2] >> 2] | 0) >>> 0) break;
  c[e >> 2] = c[(c[(c[b >> 2] | 0) + 4 >> 2] | 0) + (c[d >> 2] << 2) >> 2];
  c[g >> 2] = (c[d >> 2] | 0) + 1;
  while (1) {
   if ((c[g >> 2] | 0) >>> 0 >= (c[c[b >> 2] >> 2] | 0) >>> 0) break;
   c[f >> 2] = c[(c[(c[b >> 2] | 0) + 4 >> 2] | 0) + (c[g >> 2] << 2) >> 2];
   if ((c[e >> 2] | 0) != 0 & (c[f >> 2] | 0) != 0) if (!(Ci(c[e >> 2] | 0, c[f >> 2] | 0) | 0)) break;
   c[g >> 2] = (c[g >> 2] | 0) + 1;
  }
  a = c[e >> 2] | 0;
  if ((c[g >> 2] | 0) == (c[c[b >> 2] >> 2] | 0)) Lg(h, a); else Cj(a);
  c[d >> 2] = (c[d >> 2] | 0) + 1;
 }
 g = c[b >> 2] | 0;
 c[g >> 2] = c[h >> 2];
 c[g + 4 >> 2] = c[h + 4 >> 2];
 i = j;
 return;
}

function tf(a, b, d, e, f, g, h, j) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 g = g | 0;
 h = h | 0;
 j = j | 0;
 var k = 0, l = 0, m = 0, n = 0, o = 0, p = 0, q = 0, r = 0;
 q = i;
 i = i + 32 | 0;
 k = q + 28 | 0;
 l = q + 24 | 0;
 m = q + 20 | 0;
 n = q + 16 | 0;
 o = q + 12 | 0;
 p = q + 8 | 0;
 r = q + 4 | 0;
 c[k >> 2] = a;
 c[l >> 2] = b;
 c[m >> 2] = d;
 c[n >> 2] = e;
 c[o >> 2] = f;
 c[p >> 2] = g;
 c[r >> 2] = h;
 c[q >> 2] = j;
 if (!(c[r >> 2] | 0)) if (c[(c[k >> 2] | 0) + 132 + ((c[n >> 2] | 0) * 68 | 0) + 40 >> 2] | 0) {
  i = q;
  return;
 }
 r = nh(c[o >> 2] | 0) | 0;
 c[(c[c[l >> 2] >> 2] | 0) + (c[c[m >> 2] >> 2] << 2) >> 2] = r;
 r = c[m >> 2] | 0;
 c[r >> 2] = (c[r >> 2] | 0) + 1;
 r = mh(c[c[l >> 2] >> 2] | 0, (c[c[m >> 2] >> 2] | 0) + 1 << 2) | 0;
 c[c[l >> 2] >> 2] = r;
 if (!(c[p >> 2] | 0)) {
  i = q;
  return;
 }
 xf(c[k >> 2] | 0, c[l >> 2] | 0, c[m >> 2] | 0, c[o >> 2] | 0);
 i = q;
 return;
}

function cc() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 64 | 0;
 b = g + 48 | 0;
 f = g + 32 | 0;
 e = g + 16 | 0;
 a = g;
 if (!(d[9125] | 0)) {
  f = c[11] | 0;
  b = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[a >> 2] = 34;
  c[a + 4 >> 2] = b;
  c[a + 8 >> 2] = 10272;
  $i(f, 10265, a) | 0;
  f = c[12] | 0;
  b = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[e >> 2] = 34;
  c[e + 4 >> 2] = b;
  c[e + 8 >> 2] = 10272;
  $i(f, 10265, e) | 0;
  i = g;
  return;
 }
 if ((d[9125] | 0 | 0) == 2) {
  e = c[11] | 0;
  a = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[f >> 2] = 34;
  c[f + 4 >> 2] = a;
  c[f + 8 >> 2] = 10303;
  $i(e, 10265, f) | 0;
  f = c[12] | 0;
  e = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[b >> 2] = 34;
  c[b + 4 >> 2] = e;
  c[b + 8 >> 2] = 10303;
  $i(f, 10265, b) | 0;
  i = g;
  return;
 } else {
  bc();
  i = g;
  return;
 }
}

function Cd(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0;
 g = i;
 i = i + 48 | 0;
 f = g + 16 | 0;
 e = g;
 j = g + 32 | 0;
 h = g + 36 | 0;
 c[j >> 2] = b;
 a[h >> 0] = d;
 c[(c[383] | 0) + (c[382] << 2) >> 2] = c[j >> 2];
 a[(c[384] | 0) + (c[382] | 0) >> 0] = a[h >> 0] | 0;
 if ((c[382] | 0) != (c[385] | 0)) {
  j = c[382] | 0;
  j = j + 1 | 0;
  c[382] = j;
  i = g;
  return;
 }
 j = c[11] | 0;
 d = (c[385] | 0) + 50 | 0;
 h = c[385] | 0;
 c[e >> 2] = 12970;
 c[e + 4 >> 2] = 4;
 c[e + 8 >> 2] = d;
 c[e + 12 >> 2] = h;
 $i(j, 9481, e) | 0;
 c[383] = mh(c[383] | 0, (c[385] | 0) + 50 + 1 << 2) | 0;
 j = c[11] | 0;
 e = (c[385] | 0) + 50 | 0;
 h = c[385] | 0;
 c[f >> 2] = 12980;
 c[f + 4 >> 2] = 1;
 c[f + 8 >> 2] = e;
 c[f + 12 >> 2] = h;
 $i(j, 9481, f) | 0;
 c[384] = mh(c[384] | 0, (c[385] | 0) + 50 + 1 | 0) | 0;
 c[385] = (c[385] | 0) + 50;
 j = c[382] | 0;
 j = j + 1 | 0;
 c[382] = j;
 i = g;
 return;
}

function eg(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 j = i;
 i = i + 32 | 0;
 m = j + 24 | 0;
 e = j + 20 | 0;
 l = j + 16 | 0;
 k = j + 12 | 0;
 g = j + 8 | 0;
 h = j + 4 | 0;
 f = j;
 c[e >> 2] = a;
 c[l >> 2] = b;
 c[k >> 2] = d;
 a = c[e >> 2] | 0;
 d = c[l >> 2] | 0;
 c[m >> 2] = c[a >> 2];
 c[m + 4 >> 2] = c[a + 4 >> 2];
 c[g >> 2] = ig(m, d) | 0;
 c[h >> 2] = kh(12) | 0;
 c[c[h >> 2] >> 2] = c[l >> 2];
 c[(c[h >> 2] | 0) + 4 >> 2] = c[k >> 2];
 c[(c[h >> 2] | 0) + 8 >> 2] = 0;
 if (!(c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0)) {
  c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2] = c[h >> 2];
  i = j;
  return;
 }
 c[f >> 2] = c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2];
 while (1) {
  if (!(c[(c[f >> 2] | 0) + 8 >> 2] | 0)) break;
  c[f >> 2] = c[(c[f >> 2] | 0) + 8 >> 2];
 }
 c[(c[f >> 2] | 0) + 8 >> 2] = c[h >> 2];
 i = j;
 return;
}

function dg(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 j = i;
 i = i + 32 | 0;
 m = j + 24 | 0;
 e = j + 20 | 0;
 l = j + 16 | 0;
 k = j + 12 | 0;
 g = j + 8 | 0;
 h = j + 4 | 0;
 f = j;
 c[e >> 2] = a;
 c[l >> 2] = b;
 c[k >> 2] = d;
 a = c[e >> 2] | 0;
 d = c[l >> 2] | 0;
 c[m >> 2] = c[a >> 2];
 c[m + 4 >> 2] = c[a + 4 >> 2];
 c[g >> 2] = hg(m, d) | 0;
 c[h >> 2] = kh(12) | 0;
 c[c[h >> 2] >> 2] = c[l >> 2];
 c[(c[h >> 2] | 0) + 4 >> 2] = c[k >> 2];
 c[(c[h >> 2] | 0) + 8 >> 2] = 0;
 if (!(c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2] | 0)) {
  c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2] = c[h >> 2];
  i = j;
  return;
 }
 c[f >> 2] = c[(c[c[e >> 2] >> 2] | 0) + (c[g >> 2] << 2) >> 2];
 while (1) {
  if (!(c[(c[f >> 2] | 0) + 8 >> 2] | 0)) break;
  c[f >> 2] = c[(c[f >> 2] | 0) + 8 >> 2];
 }
 c[(c[f >> 2] | 0) + 8 >> 2] = c[h >> 2];
 i = j;
 return;
}

function Ug(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 32 | 0;
 d = j + 16 | 0;
 e = j + 12 | 0;
 f = j + 8 | 0;
 g = j + 4 | 0;
 h = j;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[h >> 2] = $g(c[e >> 2] | 0, 27871) | 0;
 a : do if (c[h >> 2] | 0) {
  if (c[h >> 2] | 0) if (!(Ci(c[h >> 2] | 0, 27880) | 0)) {
   c[d >> 2] = 1;
   b = c[d >> 2] | 0;
   i = j;
   return b | 0;
  }
  if (c[h >> 2] | 0) if (!(Ci(c[h >> 2] | 0, 27884) | 0)) {
   c[d >> 2] = 0;
   b = c[d >> 2] | 0;
   i = j;
   return b | 0;
  }
  c[g >> 2] = mg(c[e >> 2] | 0, c[h >> 2] | 0) | 0;
  while (1) {
   if (!(c[g >> 2] | 0)) break a;
   if ((c[g >> 2] | 0) != 0 & (c[f >> 2] | 0) != 0) if (!(Ci(c[g >> 2] | 0, c[f >> 2] | 0) | 0)) break;
   c[g >> 2] = mg(c[e >> 2] | 0, 0) | 0;
  }
  c[d >> 2] = 1;
  b = c[d >> 2] | 0;
  i = j;
  return b | 0;
 } while (0);
 c[d >> 2] = 0;
 b = c[d >> 2] | 0;
 i = j;
 return b | 0;
}

function ge() {
 Dd(1468, 9384);
 Dd(1548, 9385);
 if ((d[9384] | 0 | 0) == 1) if ((c[367] | 0) >= (c[386] | 0)) {
  if ((d[9385] | 0 | 0) == 1) if ((c[387] | 0) >= (c[386] | 0)) {
   c[355] = 0;
   Kd(c[387] | 0);
   c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
   c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
   while (1) {
    if ((c[365] | 0) >= (c[366] | 0)) break;
    a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
    c[259] = (c[259] | 0) + 1;
    c[365] = (c[365] | 0) + 1;
   }
   Cd(Lc() | 0, 1);
   Jd();
   return;
  }
  c[22] = (c[22] | 0) + 1;
  c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
  Cd(c[367] | 0, 1);
  Cd(c[387] | 0, a[9385] | 0);
  return;
 }
 Cd(c[367] | 0, a[9384] | 0);
 if ((d[9385] | 0 | 0) == 1) if ((c[387] | 0) >= (c[386] | 0)) {
  c[22] = (c[22] | 0) + 1;
  c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
 }
 Cd(c[387] | 0, a[9385] | 0);
 return;
}

function rh(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 n = i;
 i = i + 32 | 0;
 g = n + 20 | 0;
 h = n + 16 | 0;
 j = n + 12 | 0;
 o = n + 8 | 0;
 k = n + 4 | 0;
 l = n;
 c[g >> 2] = b;
 c[h >> 2] = d;
 c[j >> 2] = e;
 c[o >> 2] = f;
 c[k >> 2] = (c[j >> 2] | 0) + (c[o >> 2] | 0);
 while (1) {
  if (!(a[c[k >> 2] >> 0] | 0)) {
   m = 10;
   break;
  }
  if ((a[c[k >> 2] >> 0] | 0) == 47) if ((a[(c[k >> 2] | 0) + 1 >> 0] | 0) == 47) break;
  c[k >> 2] = (c[k >> 2] | 0) + 1;
 }
 if ((m | 0) == 10) {
  uh(c[g >> 2] | 0, c[h >> 2] | 0, c[j >> 2] | 0);
  i = n;
  return;
 }
 c[l >> 2] = (c[k >> 2] | 0) + 1;
 while (1) {
  if ((a[c[l >> 2] >> 0] | 0) != 47) break;
  c[l >> 2] = (c[l >> 2] | 0) + 1;
 }
 th(c[g >> 2] | 0, c[h >> 2] | 0, c[j >> 2] | 0, (c[k >> 2] | 0) - (c[j >> 2] | 0) + 1 | 0, c[l >> 2] | 0);
 i = n;
 return;
}

function oh(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 32 | 0;
 j = k;
 e = k + 20 | 0;
 f = k + 16 | 0;
 h = k + 12 | 0;
 g = k + 8 | 0;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[h >> 2] = 0;
 c[g >> 2] = c[h >> 2];
 while (1) {
  d = c[g >> 2] | 0;
  if ((a[(c[f >> 2] | 0) + (c[g >> 2] | 0) >> 0] | 0) != 47) break;
  c[g >> 2] = d + 1;
 }
 if (d >>> 0 <= ((c[h >> 2] | 0) + 1 | 0) >>> 0) {
  j = c[h >> 2] | 0;
  i = k;
  return j | 0;
 }
 if (c[(c[e >> 2] | 0) + 44 >> 2] & 1) {
  Qi(29466, c[1840] | 0) | 0;
  e = c[1840] | 0;
  b = c[h >> 2] | 0;
  c[j >> 2] = c[f >> 2];
  c[j + 4 >> 2] = b;
  $i(e, 29118, j) | 0;
  ij(c[1840] | 0) | 0;
 }
 e = (c[f >> 2] | 0) + (c[h >> 2] | 0) + 1 | 0;
 j = (c[f >> 2] | 0) + (c[g >> 2] | 0) | 0;
 Qj(e | 0, j | 0, (si((c[f >> 2] | 0) + (c[g >> 2] | 0) | 0) | 0) + 1 | 0) | 0;
 j = c[h >> 2] | 0;
 i = k;
 return j | 0;
}

function of(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 k = i;
 i = i + 32 | 0;
 n = k + 24 | 0;
 m = k + 20 | 0;
 l = k + 16 | 0;
 f = k + 12 | 0;
 h = k + 8 | 0;
 j = k + 4 | 0;
 g = k;
 c[n >> 2] = a;
 c[m >> 2] = b;
 c[l >> 2] = d;
 c[f >> 2] = e;
 c[g >> 2] = 0;
 d = (c[n >> 2] | 0) + 132 + ((c[m >> 2] | 0) * 68 | 0) | 0;
 if (c[l >> 2] | 0) c[h >> 2] = d + 36; else c[h >> 2] = d + 32;
 while (1) {
  d = c[f >> 2] | 0;
  m = (c[d >> 2] | 0) + (4 - 1) & ~(4 - 1);
  n = c[m >> 2] | 0;
  c[d >> 2] = m + 4;
  c[j >> 2] = n;
  d = c[g >> 2] | 0;
  if (!n) break;
  c[g >> 2] = d + 1;
  n = mh(c[c[h >> 2] >> 2] | 0, (c[g >> 2] | 0) + 1 << 2) | 0;
  c[c[h >> 2] >> 2] = n;
  c[(c[c[h >> 2] >> 2] | 0) + ((c[g >> 2] | 0) - 1 << 2) >> 2] = c[j >> 2];
 }
 c[(c[c[h >> 2] >> 2] | 0) + (d << 2) >> 2] = 0;
 i = k;
 return;
}

function Xd() {
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Cd(c[367] | 0, a[9384] | 0);
  Cd(c[367] | 0, a[9384] | 0);
  return;
 }
 if ((c[(c[383] | 0) + (c[382] << 2) >> 2] | 0) >= (c[386] | 0)) {
  c[22] = (c[22] | 0) + 1;
  c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
 }
 c[382] = (c[382] | 0) + 1;
 if ((c[367] | 0) < (c[386] | 0)) {
  Cd(c[367] | 0, a[9384] | 0);
  return;
 }
 while (1) {
  if (((c[259] | 0) + ((c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0)) | 0) <= (c[65] | 0)) break;
  Bb();
 }
 c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
 c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
 while (1) {
  if ((c[365] | 0) >= (c[366] | 0)) break;
  a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[64] | 0) + (c[365] | 0) >> 0] | 0;
  c[259] = (c[259] | 0) + 1;
  c[365] = (c[365] | 0) + 1;
 }
 Cd(Lc() | 0, 1);
 return;
}

function re() {
 var a = 0;
 if (c[690] | 0) {
  Lb(1);
  Kb();
  return;
 }
 c[690] = 1;
 c[67] = (c[67] | 0) + 1;
 if (!($c(125) | 0)) {
  Mb();
  Kb();
  return;
 }
 if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) {
  Ob();
  Kb();
  return;
 }
 if ((c[21] | 0) > ((c[67] | 0) + 1 | 0)) {
  Nb();
  Kb();
  return;
 }
 a = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 5, 1) | 0;
 c[118] = c[(c[167] | 0) + (a << 2) >> 2];
 if (c[263] | 0) {
  Qi(13936, c[11] | 0) | 0;
  Qi(13936, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 }
 Jc(c[118] | 0);
 if (mf((c[70] | 0) + 1 | 0) | 0) if (Ue(504, 7, 13669) | 0) {
  a = (c[691] | 0) != 0;
  Qi(13995, c[11] | 0) | 0;
  if (a) {
   Qi(13995, c[12] | 0) | 0;
   Rb();
   return;
  } else {
   Sb();
   return;
  }
 }
 Qi(13967, c[11] | 0) | 0;
 Qi(13967, c[12] | 0) | 0;
 Rb();
 c[118] = 0;
 Kb();
 return;
}

function Ii(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, i = 0;
 f = e + 16 | 0;
 g = c[f >> 2] | 0;
 if (!g) if (!(Mi(e) | 0)) {
  g = c[f >> 2] | 0;
  h = 4;
 } else f = 0; else h = 4;
 a : do if ((h | 0) == 4) {
  i = e + 20 | 0;
  h = c[i >> 2] | 0;
  if ((g - h | 0) >>> 0 < d >>> 0) {
   f = cb[c[e + 36 >> 2] & 7](e, b, d) | 0;
   break;
  }
  b : do if ((a[e + 75 >> 0] | 0) > -1) {
   f = d;
   while (1) {
    if (!f) {
     g = h;
     f = 0;
     break b;
    }
    g = f + -1 | 0;
    if ((a[b + g >> 0] | 0) == 10) break; else f = g;
   }
   if ((cb[c[e + 36 >> 2] & 7](e, b, f) | 0) >>> 0 < f >>> 0) break a;
   d = d - f | 0;
   b = b + f | 0;
   g = c[i >> 2] | 0;
  } else {
   g = h;
   f = 0;
  } while (0);
  Pj(g | 0, b | 0, d | 0) | 0;
  c[i >> 2] = (c[i >> 2] | 0) + d;
  f = f + d | 0;
 } while (0);
 return f | 0;
}

function dh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 12 | 0;
 f = h + 8 | 0;
 d = h + 4 | 0;
 g = h;
 c[f >> 2] = a;
 c[d >> 2] = b;
 c[g >> 2] = 0;
 while (1) {
  if ((c[g >> 2] | 0) >>> 0 >= (c[(c[f >> 2] | 0) + 4156 >> 2] | 0) >>> 0) {
   d = 7;
   break;
  }
  if ((c[d >> 2] | 0) != 0 ? (c[(c[(c[f >> 2] | 0) + 4152 >> 2] | 0) + (c[g >> 2] << 3) >> 2] | 0) != 0 : 0) if (!(Ci(c[(c[(c[f >> 2] | 0) + 4152 >> 2] | 0) + (c[g >> 2] << 3) >> 2] | 0, c[d >> 2] | 0) | 0)) {
   d = 5;
   break;
  }
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 if ((d | 0) == 5) {
  c[e >> 2] = c[(c[(c[f >> 2] | 0) + 4152 >> 2] | 0) + (c[g >> 2] << 3) + 4 >> 2];
  g = c[e >> 2] | 0;
  i = h;
  return g | 0;
 } else if ((d | 0) == 7) {
  c[e >> 2] = 0;
  g = c[e >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function qh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 12 | 0;
 f = h + 8 | 0;
 d = h + 4 | 0;
 g = h;
 c[f >> 2] = a;
 c[d >> 2] = b;
 c[g >> 2] = 0;
 while (1) {
  if ((c[g >> 2] | 0) >>> 0 >= (c[(c[f >> 2] | 0) + 60 >> 2] | 0) >>> 0) {
   d = 7;
   break;
  }
  if ((c[d >> 2] | 0) != 0 ? (c[(c[(c[f >> 2] | 0) + 56 >> 2] | 0) + (c[g >> 2] << 3) >> 2] | 0) != 0 : 0) if (!(Ci(c[(c[(c[f >> 2] | 0) + 56 >> 2] | 0) + (c[g >> 2] << 3) >> 2] | 0, c[d >> 2] | 0) | 0)) {
   d = 5;
   break;
  }
  c[g >> 2] = (c[g >> 2] | 0) + 1;
 }
 if ((d | 0) == 5) {
  c[e >> 2] = c[(c[(c[f >> 2] | 0) + 56 >> 2] | 0) + (c[g >> 2] << 3) + 4 >> 2];
  g = c[e >> 2] | 0;
  i = h;
  return g | 0;
 } else if ((d | 0) == 7) {
  c[e >> 2] = 0;
  g = c[e >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function bg(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 16 | 0;
 f = k + 12 | 0;
 g = k + 8 | 0;
 j = k + 4 | 0;
 h = k;
 c[f >> 2] = b;
 while (1) {
  if (a[c[f >> 2] >> 0] | 0) if (hi(a[c[f >> 2] >> 0] | 0) | 0) e = (ni(d[c[f >> 2] >> 0] | 0) | 0) != 0; else e = 0; else e = 0;
  b = c[f >> 2] | 0;
  if (!e) break;
  c[f >> 2] = b + 1;
 }
 c[j >> 2] = b;
 while (1) {
  if (a[c[f >> 2] >> 0] | 0) {
   if (hi(a[c[f >> 2] >> 0] | 0) | 0) b = (ni(d[c[f >> 2] >> 0] | 0) | 0) != 0; else b = 0;
   e = b ^ 1;
  } else e = 0;
  b = c[f >> 2] | 0;
  if (!e) break;
  c[f >> 2] = b + 1;
 }
 c[g >> 2] = b - (c[j >> 2] | 0);
 c[h >> 2] = kh((c[g >> 2] | 0) + 1 | 0) | 0;
 Ai(c[h >> 2] | 0, c[j >> 2] | 0, c[g >> 2] | 0) | 0;
 a[(c[h >> 2] | 0) + (c[g >> 2] | 0) >> 0] = 0;
 i = k;
 return c[h >> 2] | 0;
}

function Pi(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
 n = i;
 i = i + 128 | 0;
 g = n + 112 | 0;
 m = n;
 h = m;
 j = 7412;
 k = h + 112 | 0;
 do {
  c[h >> 2] = c[j >> 2];
  h = h + 4 | 0;
  j = j + 4 | 0;
 } while ((h | 0) < (k | 0));
 if ((d + -1 | 0) >>> 0 > 2147483646) if (!d) {
  d = 1;
  l = 4;
 } else {
  c[(Hi() | 0) >> 2] = 75;
  d = -1;
 } else {
  g = b;
  l = 4;
 }
 if ((l | 0) == 4) {
  l = -2 - g | 0;
  l = d >>> 0 > l >>> 0 ? l : d;
  c[m + 48 >> 2] = l;
  b = m + 20 | 0;
  c[b >> 2] = g;
  c[m + 44 >> 2] = g;
  d = g + l | 0;
  g = m + 16 | 0;
  c[g >> 2] = d;
  c[m + 28 >> 2] = d;
  d = pj(m, e, f) | 0;
  if (l) {
   e = c[b >> 2] | 0;
   a[e + (((e | 0) == (c[g >> 2] | 0)) << 31 >> 31) >> 0] = 0;
  }
 }
 i = n;
 return d | 0;
}

function Md() {
 var b = 0, e = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 b = d[9384] | 0;
 if ((d[9384] | 0 | 0) != (d[9385] | 0 | 0)) {
  if ((b | 0) != 4) if ((d[9385] | 0 | 0) != 4) {
   Bc(c[367] | 0, a[9384] | 0);
   Qi(13198, c[11] | 0) | 0;
   Qi(13198, c[12] | 0) | 0;
   Bc(c[387] | 0, a[9385] | 0);
   rb();
   Qi(13201, c[11] | 0) | 0;
   Qi(13201, c[12] | 0) | 0;
   wc();
  }
  Cd(0, 0);
  return;
 }
 if (b) if ((d[9384] | 0 | 0) != 1) {
  if ((d[9384] | 0 | 0) != 4) {
   Bc(c[367] | 0, a[9384] | 0);
   Qi(13239, c[11] | 0) | 0;
   Qi(13239, c[12] | 0) | 0;
   wc();
  }
  Cd(0, 0);
  return;
 }
 b = c[387] | 0;
 e = c[367] | 0;
 if (!(d[9384] | 0)) if ((b | 0) == (e | 0)) {
  Cd(1, 0);
  return;
 } else {
  Cd(0, 0);
  return;
 } else if (Nc(b, e) | 0) {
  Cd(1, 0);
  return;
 } else {
  Cd(0, 0);
  return;
 }
}

function Rc(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 16 | 0;
 g = m + 4 | 0;
 h = m + 10 | 0;
 j = m + 9 | 0;
 l = m + 8 | 0;
 k = m;
 c[g >> 2] = b;
 a[h >> 0] = e;
 a[j >> 0] = f;
 a[l >> 0] = 1;
 c[k >> 2] = d[h >> 0];
 if ((d[l >> 0] | 0 | 0) > (c[k >> 2] | 0)) {
  f = c[15] | 0;
  e = a[h >> 0] | 0;
  e = e & 255;
  b = a[j >> 0] | 0;
  b = Qc(f, 1, e, b, 1) | 0;
  c[268] = b;
  i = m;
  return;
 }
 do {
  a[(c[15] | 0) + (d[l >> 0] | 0) >> 0] = a[8357 + (d[(c[g >> 2] | 0) + ((d[l >> 0] | 0) - 1) >> 0] | 0) >> 0] | 0;
  b = a[l >> 0] | 0;
  a[l >> 0] = b + 1 << 24 >> 24;
 } while ((b & 255 | 0) < (c[k >> 2] | 0));
 f = c[15] | 0;
 e = a[h >> 0] | 0;
 e = e & 255;
 b = a[j >> 0] | 0;
 b = Qc(f, 1, e, b, 1) | 0;
 c[268] = b;
 i = m;
 return;
}

function jc(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 h = i;
 i = i + 32 | 0;
 g = h;
 b = h + 28 | 0;
 e = h + 24 | 0;
 f = h + 20 | 0;
 d = h + 16 | 0;
 c[b >> 2] = a;
 if ((c[b >> 2] | 0) <= (c[170] | 0)) {
  i = h;
  return;
 }
 c[f >> 2] = c[170];
 a = c[11] | 0;
 k = (c[b >> 2] | 0) + 5e3 | 0;
 j = c[170] | 0;
 c[g >> 2] = 10416;
 c[g + 4 >> 2] = 4;
 c[g + 8 >> 2] = k;
 c[g + 12 >> 2] = j;
 $i(a, 9481, g) | 0;
 c[171] = mh(c[171] | 0, (c[b >> 2] | 0) + 5e3 + 1 << 2) | 0;
 c[170] = (c[b >> 2] | 0) + 5e3;
 c[e >> 2] = c[f >> 2];
 c[d >> 2] = (c[170] | 0) - 1;
 if ((c[e >> 2] | 0) > (c[d >> 2] | 0)) {
  i = h;
  return;
 }
 do {
  c[(c[171] | 0) + (c[e >> 2] << 2) >> 2] = 0;
  k = c[e >> 2] | 0;
  c[e >> 2] = k + 1;
 } while ((k | 0) < (c[d >> 2] | 0));
 i = h;
 return;
}

function _e(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 48 | 0;
 k = m;
 e = m + 32 | 0;
 f = m + 28 | 0;
 g = m + 24 | 0;
 j = m + 20 | 0;
 h = m + 16 | 0;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[g >> 2] = d;
 c[j >> 2] = ah(c[f >> 2] | 0) | 0;
 c[c[e >> 2] >> 2] = c[g >> 2];
 if (!(c[j >> 2] | 0)) {
  i = m;
  return;
 }
 c[h >> 2] = oi(c[j >> 2] | 0) | 0;
 if ((c[h >> 2] | 0) < 0) l = 4; else if ((c[h >> 2] | 0) == 0 & (c[g >> 2] | 0) > 0) l = 4; else c[c[e >> 2] >> 2] = c[h >> 2];
 if ((l | 0) == 4) {
  l = c[1840] | 0;
  d = c[h >> 2] | 0;
  a = c[f >> 2] | 0;
  b = c[g >> 2] | 0;
  c[k >> 2] = c[763];
  c[k + 4 >> 2] = d;
  c[k + 8 >> 2] = a;
  c[k + 12 >> 2] = b;
  $i(l, 16479, k) | 0;
 }
 Cj(c[j >> 2] | 0);
 i = m;
 return;
}

function yi(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 f = d & 255;
 a : do if (!f) b = b + (si(b) | 0) | 0; else {
  if (b & 3) {
   e = d & 255;
   do {
    g = a[b >> 0] | 0;
    if (g << 24 >> 24 == 0 ? 1 : g << 24 >> 24 == e << 24 >> 24) break a;
    b = b + 1 | 0;
   } while ((b & 3 | 0) != 0);
  }
  f = _(f, 16843009) | 0;
  e = c[b >> 2] | 0;
  b : do if (!((e & -2139062144 ^ -2139062144) & e + -16843009)) do {
   g = e ^ f;
   if ((g & -2139062144 ^ -2139062144) & g + -16843009) break b;
   b = b + 4 | 0;
   e = c[b >> 2] | 0;
  } while (((e & -2139062144 ^ -2139062144) & e + -16843009 | 0) == 0); while (0);
  e = d & 255;
  while (1) {
   g = a[b >> 0] | 0;
   if (g << 24 >> 24 == 0 ? 1 : g << 24 >> 24 == e << 24 >> 24) break; else b = b + 1 | 0;
  }
 } while (0);
 return b | 0;
}

function Hh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, j = 0, k = 0, l = 0.0, m = 0.0;
 k = i;
 i = i + 32 | 0;
 d = k + 20 | 0;
 e = k + 16 | 0;
 j = k;
 g = k + 12 | 0;
 f = k + 8 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 c[f >> 2] = 0;
 if ((c[d >> 2] | 0) < 0) {
  c[f >> 2] = 1;
  c[d >> 2] = 0 - (c[d >> 2] | 0);
 }
 if (c[d >> 2] & 1) {
  c[d >> 2] = c[d >> 2] & -2;
  h[j >> 3] = 1.095445115;
 } else h[j >> 3] = 1.0;
 while (1) {
  if ((c[d >> 2] | 0) <= 8) break;
  c[d >> 2] = (c[d >> 2] | 0) - 8;
  h[j >> 3] = +h[j >> 3] * 2.0736;
 }
 while (1) {
  if ((c[d >> 2] | 0) <= 0) break;
  c[d >> 2] = (c[d >> 2] | 0) - 2;
  h[j >> 3] = +h[j >> 3] * 1.2;
 }
 m = +(c[e >> 2] | 0);
 l = +h[j >> 3];
 c[g >> 2] = ~~(((c[f >> 2] | 0) != 0 ? m / l : m * l) + .5);
 i = k;
 return c[g >> 2] | 0;
}

function Dd(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 f = h + 4 | 0;
 g = h;
 c[f >> 2] = b;
 c[g >> 2] = e;
 if (!(c[382] | 0)) {
  Qi(12993, c[11] | 0) | 0;
  Qi(12993, c[12] | 0) | 0;
  wc();
  a[c[g >> 2] >> 0] = 4;
  i = h;
  return;
 }
 c[382] = (c[382] | 0) - 1;
 c[c[f >> 2] >> 2] = c[(c[383] | 0) + (c[382] << 2) >> 2];
 a[c[g >> 2] >> 0] = a[(c[384] | 0) + (c[382] | 0) >> 0] | 0;
 if ((d[c[g >> 2] >> 0] | 0 | 0) != 1) {
  i = h;
  return;
 }
 if ((c[c[f >> 2] >> 2] | 0) < (c[386] | 0)) {
  i = h;
  return;
 }
 if ((c[c[f >> 2] >> 2] | 0) != ((c[22] | 0) - 1 | 0)) {
  Qi(13030, c[11] | 0) | 0;
  Qi(13030, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 }
 c[22] = (c[22] | 0) - 1;
 c[259] = c[(c[63] | 0) + (c[22] << 2) >> 2];
 i = h;
 return;
}

function xf(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 k = i;
 i = i + 32 | 0;
 m = k + 20 | 0;
 f = k + 16 | 0;
 g = k + 12 | 0;
 l = k + 8 | 0;
 j = k + 4 | 0;
 h = k;
 c[m >> 2] = a;
 c[f >> 2] = b;
 c[g >> 2] = d;
 c[l >> 2] = e;
 c[j >> 2] = _f(c[m >> 2] | 0, c[l >> 2] | 0) | 0;
 if (!(c[j >> 2] | 0)) {
  i = k;
  return;
 }
 while (1) {
  m = c[j >> 2] | 0;
  c[j >> 2] = m + 4;
  m = c[m >> 2] | 0;
  c[h >> 2] = m;
  if (!m) break;
  m = nh(c[h >> 2] | 0) | 0;
  c[(c[c[f >> 2] >> 2] | 0) + (c[c[g >> 2] >> 2] << 2) >> 2] = m;
  m = c[g >> 2] | 0;
  c[m >> 2] = (c[m >> 2] | 0) + 1;
  m = mh(c[c[f >> 2] >> 2] | 0, (c[c[g >> 2] >> 2] | 0) + 1 << 2) | 0;
  c[c[f >> 2] >> 2] = m;
 }
 i = k;
 return;
}

function Yd() {
 var b = 0;
 Dd(1468, 9384);
 switch (d[9384] | 0 | 0) {
 case 1:
  {
   c[365] = c[(c[63] | 0) + (c[367] << 2) >> 2];
   c[366] = c[(c[63] | 0) + ((c[367] | 0) + 1 << 2) >> 2];
   while (1) {
    if ((c[365] | 0) >= (c[366] | 0)) {
     b = 7;
     break;
    }
    if ((d[8613 + (d[(c[64] | 0) + (c[365] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) {
     b = 5;
     break;
    }
    c[365] = (c[365] | 0) + 1;
   }
   if ((b | 0) == 5) {
    Cd(0, 0);
    return;
   } else if ((b | 0) == 7) {
    Cd(1, 0);
    return;
   }
   break;
  }
 case 3:
  {
   Cd(1, 0);
   return;
  }
 case 4:
  {
   Cd(0, 0);
   return;
  }
 default:
  {
   Bc(c[367] | 0, a[9384] | 0);
   Qi(13416, c[11] | 0) | 0;
   Qi(13416, c[12] | 0) | 0;
   wc();
   Cd(0, 0);
   return;
  }
 }
}

function vi(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = d;
 a : do if (!((e ^ b) & 3)) {
  if (e & 3) do {
   e = a[d >> 0] | 0;
   a[b >> 0] = e;
   if (!(e << 24 >> 24)) break a;
   d = d + 1 | 0;
   b = b + 1 | 0;
  } while ((d & 3 | 0) != 0);
  e = c[d >> 2] | 0;
  if (!((e & -2139062144 ^ -2139062144) & e + -16843009)) {
   f = b;
   while (1) {
    d = d + 4 | 0;
    b = f + 4 | 0;
    c[f >> 2] = e;
    e = c[d >> 2] | 0;
    if ((e & -2139062144 ^ -2139062144) & e + -16843009) break; else f = b;
   }
  }
  f = 8;
 } else f = 8; while (0);
 if ((f | 0) == 8) {
  f = a[d >> 0] | 0;
  a[b >> 0] = f;
  if (f << 24 >> 24) do {
   d = d + 1 | 0;
   b = b + 1 | 0;
   f = a[d >> 0] | 0;
   a[b >> 0] = f;
  } while (f << 24 >> 24 != 0);
 }
 return b | 0;
}

function cd(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 16 | 0;
 g = l + 6 | 0;
 h = l + 5 | 0;
 j = l + 4 | 0;
 k = l;
 a[g >> 0] = b;
 a[h >> 0] = e;
 a[j >> 0] = f;
 c[66] = c[67];
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[g >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[h >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[j >> 0] | 0 | 0)) e = (c[67] | 0) < (c[21] | 0); else e = 0; else e = 0; else e = 0;
  b = c[67] | 0;
  if (!e) break;
  c[67] = b + 1;
 }
 if ((b | 0) < (c[21] | 0)) {
  c[k >> 2] = 1;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 } else {
  c[k >> 2] = 0;
  k = c[k >> 2] | 0;
  i = l;
  return k | 0;
 }
 return 0;
}

function Ef(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 e = l + 20 | 0;
 f = l + 16 | 0;
 g = l + 12 | 0;
 j = l + 8 | 0;
 k = l + 4 | 0;
 h = l;
 c[e >> 2] = a;
 c[f >> 2] = b;
 c[g >> 2] = d;
 if (c[f >> 2] | 0) a = si(c[f >> 2] | 0) | 0; else a = 0;
 c[j >> 2] = a;
 if (c[g >> 2] | 0) a = si(c[g >> 2] | 0) | 0; else a = 0;
 c[k >> 2] = a;
 d = si(c[e >> 2] | 0) | 0;
 c[h >> 2] = kh(d + (c[j >> 2] | 0) + (c[k >> 2] | 0) + 1 | 0) | 0;
 zi(c[h >> 2] | 0, c[e >> 2] | 0) | 0;
 if (c[f >> 2] | 0) pi(c[h >> 2] | 0, c[f >> 2] | 0) | 0;
 if (!(c[g >> 2] | 0)) {
  k = c[h >> 2] | 0;
  i = l;
  return k | 0;
 }
 pi(c[h >> 2] | 0, c[g >> 2] | 0) | 0;
 k = c[h >> 2] | 0;
 i = l;
 return k | 0;
}

function Pc(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 32 | 0;
 g = m + 16 | 0;
 h = m + 12 | 0;
 j = m + 8 | 0;
 l = m + 4 | 0;
 k = m;
 c[g >> 2] = b;
 c[h >> 2] = e;
 c[j >> 2] = f;
 if ((c[j >> 2] | 0) <= 0) {
  i = m;
  return;
 }
 c[l >> 2] = c[h >> 2];
 c[k >> 2] = (c[h >> 2] | 0) + (c[j >> 2] | 0) - 1;
 if ((c[l >> 2] | 0) > (c[k >> 2] | 0)) {
  i = m;
  return;
 }
 do {
  if ((d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0 | 0) >= 97) if ((d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0 | 0) <= 122) a[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] = (d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0) - 32;
  f = c[l >> 2] | 0;
  c[l >> 2] = f + 1;
 } while ((f | 0) < (c[k >> 2] | 0));
 i = m;
 return;
}

function sf(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 h = i;
 i = i + 32 | 0;
 j = h + 16 | 0;
 g = h + 12 | 0;
 f = h + 8 | 0;
 e = h + 4 | 0;
 d = h;
 c[j >> 2] = b;
 c[g >> 2] = kh((si(c[j >> 2] | 0) | 0) + 1 | 0) | 0;
 c[f >> 2] = c[g >> 2];
 c[e >> 2] = c[j >> 2];
 c[d >> 2] = 1;
 while (1) {
  if (!(a[c[e >> 2] >> 0] | 0)) break;
  if (c[d >> 2] | 0) if (a[c[e >> 2] >> 0] | 0) if ((a[c[e >> 2] >> 0] | 0) == 33) if ((a[(c[e >> 2] | 0) + 1 >> 0] | 0) == 33) {
   c[e >> 2] = (c[e >> 2] | 0) + 2;
   continue;
  }
  c[d >> 2] = (a[c[e >> 2] >> 0] | 0) == 58 & 1;
  b = c[e >> 2] | 0;
  c[e >> 2] = b + 1;
  b = a[b >> 0] | 0;
  j = c[f >> 2] | 0;
  c[f >> 2] = j + 1;
  a[j >> 0] = b;
 }
 a[c[f >> 2] >> 0] = 0;
 i = h;
 return c[g >> 2] | 0;
}

function Oc(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 32 | 0;
 g = m + 16 | 0;
 h = m + 12 | 0;
 j = m + 8 | 0;
 l = m + 4 | 0;
 k = m;
 c[g >> 2] = b;
 c[h >> 2] = e;
 c[j >> 2] = f;
 if ((c[j >> 2] | 0) <= 0) {
  i = m;
  return;
 }
 c[l >> 2] = c[h >> 2];
 c[k >> 2] = (c[h >> 2] | 0) + (c[j >> 2] | 0) - 1;
 if ((c[l >> 2] | 0) > (c[k >> 2] | 0)) {
  i = m;
  return;
 }
 do {
  if ((d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0 | 0) >= 65) if ((d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0 | 0) <= 90) a[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] = (d[(c[g >> 2] | 0) + (c[l >> 2] | 0) >> 0] | 0) + 32;
  f = c[l >> 2] | 0;
  c[l >> 2] = f + 1;
 } while ((f | 0) < (c[k >> 2] | 0));
 i = m;
 return;
}

function gd() {
 var b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f;
 e = f + 4 | 0;
 c[66] = c[67];
 if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) == 45) {
  a[e >> 0] = 1;
  c[67] = (c[67] | 0) + 1;
 } else a[e >> 0] = 0;
 c[330] = 0;
 while (1) {
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 3) break;
  if ((c[67] | 0) >= (c[21] | 0)) break;
  c[330] = ((c[330] | 0) * 10 | 0) + ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) - 48);
  c[67] = (c[67] | 0) + 1;
 }
 if ((d[e >> 0] | 0 | 0) == 1) c[330] = 0 - (c[330] | 0);
 if (((c[67] | 0) - (c[66] | 0) | 0) == (d[e >> 0] | 0 | 0)) {
  c[b >> 2] = 0;
  e = c[b >> 2] | 0;
  i = f;
  return e | 0;
 } else {
  c[b >> 2] = 1;
  e = c[b >> 2] | 0;
  i = f;
  return e | 0;
 }
 return 0;
}

function Jc(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = b;
 Cj(c[70] | 0);
 c[70] = kh((c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0) + 1 + 1 | 0) | 0;
 c[68] = 1;
 c[e >> 2] = c[(c[63] | 0) + (c[d >> 2] << 2) >> 2];
 while (1) {
  if ((c[e >> 2] | 0) >= (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0)) break;
  a[(c[70] | 0) + (c[68] | 0) >> 0] = a[(c[64] | 0) + (c[e >> 2] | 0) >> 0] | 0;
  c[68] = (c[68] | 0) + 1;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 c[71] = (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0);
 a[(c[70] | 0) + ((c[71] | 0) + 1) >> 0] = 0;
 i = f;
 return;
}

function di(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 do if (!b) b = 1; else {
  if (d >>> 0 < 128) {
   a[b >> 0] = d;
   b = 1;
   break;
  }
  if (d >>> 0 < 2048) {
   a[b >> 0] = d >>> 6 | 192;
   a[b + 1 >> 0] = d & 63 | 128;
   b = 2;
   break;
  }
  if (d >>> 0 < 55296 | (d & -8192 | 0) == 57344) {
   a[b >> 0] = d >>> 12 | 224;
   a[b + 1 >> 0] = d >>> 6 & 63 | 128;
   a[b + 2 >> 0] = d & 63 | 128;
   b = 3;
   break;
  }
  if ((d + -65536 | 0) >>> 0 < 1048576) {
   a[b >> 0] = d >>> 18 | 240;
   a[b + 1 >> 0] = d >>> 12 & 63 | 128;
   a[b + 2 >> 0] = d >>> 6 & 63 | 128;
   a[b + 3 >> 0] = d & 63 | 128;
   b = 4;
   break;
  } else {
   c[(Hi() | 0) >> 2] = 84;
   b = -1;
   break;
  }
 } while (0);
 return b | 0;
}

function Cc(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 h = j + 8 | 0;
 g = j;
 f = j + 12 | 0;
 k = j + 16 | 0;
 c[f >> 2] = b;
 a[k >> 0] = e;
 switch (d[k >> 0] | 0 | 0) {
 case 0:
  {
   k = c[11] | 0;
   c[g >> 2] = c[f >> 2];
   $i(k, 11029, g) | 0;
   k = c[12] | 0;
   c[h >> 2] = c[f >> 2];
   $i(k, 11029, h) | 0;
   i = j;
   return;
  }
 case 1:
  {
   Ab(c[f >> 2] | 0);
   rb();
   i = j;
   return;
  }
 case 2:
  {
   Ab(c[(c[167] | 0) + (c[f >> 2] << 2) >> 2] | 0);
   rb();
   i = j;
   return;
  }
 case 3:
  {
   Ab(c[f >> 2] | 0);
   rb();
   i = j;
   return;
  }
 case 4:
  {
   zc();
   i = j;
   return;
  }
 default:
  {
   Ac();
   i = j;
   return;
  }
 }
}

function bd(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 16 | 0;
 f = j + 5 | 0;
 g = j + 4 | 0;
 h = j;
 a[f >> 0] = b;
 a[g >> 0] = e;
 c[66] = c[67];
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[f >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[g >> 0] | 0 | 0)) if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) e = (c[67] | 0) < (c[21] | 0); else e = 0; else e = 0; else e = 0;
  b = c[67] | 0;
  if (!e) break;
  c[67] = b + 1;
 }
 if ((b | 0) < (c[21] | 0)) {
  c[h >> 2] = 1;
  h = c[h >> 2] | 0;
  i = j;
  return h | 0;
 } else {
  c[h >> 2] = 0;
  h = c[h >> 2] | 0;
  i = j;
  return h | 0;
 }
 return 0;
}

function Yf(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
 f = i;
 i = i + 48 | 0;
 g = f + 40 | 0;
 j = f + 32 | 0;
 m = f + 28 | 0;
 n = f + 24 | 0;
 k = f + 20 | 0;
 l = f + 16 | 0;
 h = f + 8 | 0;
 o = f;
 c[j >> 2] = b;
 c[m >> 2] = d;
 c[n >> 2] = e;
 Xf(o);
 c[h >> 2] = c[o >> 2];
 c[h + 4 >> 2] = c[o + 4 >> 2];
 c[l >> 2] = (c[n >> 2] | 0) - (c[m >> 2] | 0);
 c[k >> 2] = kh((c[l >> 2] | 0) + 1 | 0) | 0;
 Ai(c[k >> 2] | 0, c[m >> 2] | 0, c[l >> 2] | 0) | 0;
 a[(c[k >> 2] | 0) + (c[l >> 2] | 0) >> 0] = 0;
 Lg(h, c[k >> 2] | 0);
 d = c[j >> 2] | 0;
 c[g >> 2] = c[h >> 2];
 c[g + 4 >> 2] = c[h + 4 >> 2];
 Og(d, g);
 i = f;
 return;
}

function xh(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 12 | 0;
 h = g + 8 | 0;
 f = g + 4 | 0;
 d = g;
 c[h >> 2] = b;
 c[f >> 2] = ri(c[h >> 2] | 0, 46) | 0;
 if (!(c[f >> 2] | 0)) {
  c[e >> 2] = 0;
  h = c[e >> 2] | 0;
  i = g;
  return h | 0;
 }
 c[d >> 2] = (c[f >> 2] | 0) + 1;
 while (1) {
  if (!(a[c[d >> 2] >> 0] | 0)) {
   b = 8;
   break;
  }
  if ((a[c[d >> 2] >> 0] | 0) == 47) {
   b = 6;
   break;
  }
  c[d >> 2] = (c[d >> 2] | 0) + 1;
 }
 if ((b | 0) == 6) {
  c[e >> 2] = 0;
  h = c[e >> 2] | 0;
  i = g;
  return h | 0;
 } else if ((b | 0) == 8) {
  c[e >> 2] = (c[f >> 2] | 0) + 1;
  h = c[e >> 2] | 0;
  i = g;
  return h | 0;
 }
 return 0;
}

function Ig(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = b;
 c[e >> 2] = c[d >> 2];
 while (1) {
  if (!(a[c[e >> 2] >> 0] | 0)) break;
  if ((a[c[e >> 2] >> 0] | 0) == 47) if ((c[e >> 2] | 0) != (c[d >> 2] | 0)) break;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 Ai(23766, c[d >> 2] | 0, (c[e >> 2] | 0) - (c[d >> 2] | 0) | 0) | 0;
 a[23766 + ((c[e >> 2] | 0) - (c[d >> 2] | 0)) >> 0] = 0;
 if ((a[c[e >> 2] >> 0] | 0) == 47) c[e >> 2] = (c[e >> 2] | 0) + 1;
 do {
  b = c[e >> 2] | 0;
  c[e >> 2] = b + 1;
  b = a[b >> 0] | 0;
  g = c[d >> 2] | 0;
  c[d >> 2] = g + 1;
  a[g >> 0] = b;
 } while ((b << 24 >> 24 | 0) != 0);
 i = f;
 return 23766;
}

function we() {
 c[179] = c[172];
 c[695] = c[115];
 if (c[692] | 0) {
  if (!((c[179] | 0) != 0 | (c[350] | 0) != 0)) {
   Vb();
   Qi(14279, c[11] | 0) | 0;
   Qi(14279, c[12] | 0) | 0;
   Wb();
  }
 } else {
  Vb();
  Qi(14260, c[11] | 0) | 0;
  Qi(14260, c[12] | 0) | 0;
  Wb();
 }
 if (c[688] | 0) {
  if (!(c[695] | 0)) {
   Vb();
   Qi(14306, c[11] | 0) | 0;
   Qi(14306, c[12] | 0) | 0;
   Wb();
  }
 } else {
  Vb();
  Qi(14289, c[11] | 0) | 0;
  Qi(14289, c[12] | 0) | 0;
  Wb();
 }
 if (!(c[690] | 0)) {
  Vb();
  Qi(14321, c[11] | 0) | 0;
  Qi(14321, c[12] | 0) | 0;
  Wb();
  return;
 }
 if (c[118] | 0) return;
 Vb();
 Qi(14339, c[11] | 0) | 0;
 Qi(14339, c[12] | 0) | 0;
 Wb();
 return;
}

function Ke() {
 var a = 0, b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 a = d + 4 | 0;
 b = d;
 Bg(c[c[721] >> 2] | 0, 13740);
 c[a >> 2] = 100;
 c[b >> 2] = 15316;
 _e(1116, c[b >> 2] | 0, c[a >> 2] | 0);
 if ((c[279] | 0) < (c[a >> 2] | 0)) c[279] = c[a >> 2];
 c[a >> 2] = 1e3;
 c[b >> 2] = 15329;
 _e(1316, c[b >> 2] | 0, c[a >> 2] | 0);
 if ((c[329] | 0) < (c[a >> 2] | 0)) c[329] = c[a >> 2];
 c[a >> 2] = 4e3;
 c[b >> 2] = 15343;
 _e(92, c[b >> 2] | 0, c[a >> 2] | 0);
 if ((c[23] | 0) < (c[a >> 2] | 0)) c[23] = c[a >> 2];
 b = c[23] | 0;
 c[267] = b;
 c[267] = (c[267] | 0) < 5e3 ? 5e3 : b;
 c[717] = (c[267] | 0) + 1 - 1;
 c[335] = (c[717] | 0) + 1;
 c[408] = (c[717] | 0) + 1;
 i = d;
 return;
}

function Vi(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 if ((c[d + 76 >> 2] | 0) < 0) g = 3; else if (!(cj(d) | 0)) g = 3; else {
  if ((a[d + 75 >> 0] | 0) == (b | 0)) g = 10; else {
   e = d + 20 | 0;
   f = c[e >> 2] | 0;
   if (f >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
    c[e >> 2] = f + 1;
    a[f >> 0] = b;
    e = b & 255;
   } else g = 10;
  }
  if ((g | 0) == 10) e = gj(d, b) | 0;
  dj(d);
 }
 do if ((g | 0) == 3) {
  if ((a[d + 75 >> 0] | 0) != (b | 0)) {
   f = d + 20 | 0;
   e = c[f >> 2] | 0;
   if (e >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
    c[f >> 2] = e + 1;
    a[e >> 0] = b;
    e = b & 255;
    break;
   }
  }
  e = gj(d, b) | 0;
 } while (0);
 return e | 0;
}

function Ki(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 if ((c[d + 76 >> 2] | 0) < 0) g = 3; else if (!(cj(d) | 0)) g = 3; else {
  if ((a[d + 75 >> 0] | 0) == (b | 0)) g = 10; else {
   e = d + 20 | 0;
   f = c[e >> 2] | 0;
   if (f >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
    c[e >> 2] = f + 1;
    a[f >> 0] = b;
    e = b & 255;
   } else g = 10;
  }
  if ((g | 0) == 10) e = gj(d, b) | 0;
  dj(d);
 }
 do if ((g | 0) == 3) {
  if ((a[d + 75 >> 0] | 0) != (b | 0)) {
   f = d + 20 | 0;
   e = c[f >> 2] | 0;
   if (e >>> 0 < (c[d + 16 >> 2] | 0) >>> 0) {
    c[f >> 2] = e + 1;
    a[e >> 0] = b;
    e = b & 255;
    break;
   }
  }
  e = gj(d, b) | 0;
 } while (0);
 return e | 0;
}

function yb(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 4 | 0;
 f = g;
 c[e >> 2] = b;
 c[21] = 0;
 if (Oe(c[e >> 2] | 0) | 0) {
  c[f >> 2] = 0;
  b = c[f >> 2] | 0;
  i = g;
  return b | 0;
 }
 while (1) {
  if (!((Pe(c[e >> 2] | 0) | 0) != 0 ^ 1)) break;
  if ((c[21] | 0) >= (c[14] | 0)) xb();
  b = a[8357 + (Oi(c[e >> 2] | 0) | 0) >> 0] | 0;
  a[(c[15] | 0) + (c[21] | 0) >> 0] = b;
  c[21] = (c[21] | 0) + 1;
 }
 Oi(c[e >> 2] | 0) | 0;
 while (1) {
  if ((c[21] | 0) <= 0) break;
  if ((d[8613 + (d[(c[15] | 0) + ((c[21] | 0) - 1) >> 0] | 0) >> 0] | 0 | 0) != 1) break;
  c[21] = (c[21] | 0) - 1;
 }
 c[f >> 2] = 1;
 b = c[f >> 2] | 0;
 i = g;
 return b | 0;
}

function lc(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 f = i;
 i = i + 48 | 0;
 g = f + 24 | 0;
 k = f;
 h = f + 45 | 0;
 j = f + 44 | 0;
 a[h >> 0] = b;
 a[j >> 0] = e;
 e = c[11] | 0;
 l = d[8869 + (d[h >> 0] | 0) >> 0] | 0;
 b = d[8869 + (d[j >> 0] | 0) >> 0] | 0;
 c[k >> 2] = 10467;
 c[k + 4 >> 2] = l;
 c[k + 8 >> 2] = 10487;
 c[k + 12 >> 2] = b;
 c[k + 16 >> 2] = 39;
 $i(e, 10456, k) | 0;
 e = c[12] | 0;
 h = d[8869 + (d[h >> 0] | 0) >> 0] | 0;
 b = d[8869 + (d[j >> 0] | 0) >> 0] | 0;
 c[g >> 2] = 10467;
 c[g + 4 >> 2] = h;
 c[g + 8 >> 2] = 10487;
 c[g + 12 >> 2] = b;
 c[g + 16 >> 2] = 39;
 $i(e, 10456, g) | 0;
 hc();
 i = f;
 return;
}

function qf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 48 | 0;
 d = k + 36 | 0;
 e = k + 32 | 0;
 g = k + 28 | 0;
 h = k + 24 | 0;
 f = k + 8 | 0;
 j = k;
 c[e >> 2] = a;
 if (!(c[e >> 2] | 0)) {
  c[d >> 2] = 0;
  b = c[d >> 2] | 0;
  i = k;
  return b | 0;
 }
 c[h >> 2] = nh(c[e >> 2] | 0) | 0;
 c[f >> 2] = b;
 while (1) {
  a = (c[f >> 2] | 0) + (4 - 1) & ~(4 - 1);
  b = c[a >> 2] | 0;
  c[f >> 2] = a + 4;
  c[g >> 2] = b;
  if (!b) break;
  c[j >> 2] = Ef(c[h >> 2] | 0, 19872, c[g >> 2] | 0) | 0;
  Cj(c[h >> 2] | 0);
  c[h >> 2] = c[j >> 2];
 }
 c[d >> 2] = c[h >> 2];
 b = c[d >> 2] | 0;
 i = k;
 return b | 0;
}

function Sh(a) {
 a = a | 0;
 var b = 0, d = 0, f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 16 | 0;
 d = j;
 g = a + 8 | 0;
 b = c[g >> 2] | 0;
 f = a + 12 | 0;
 do if ((b | 0) < (c[f >> 2] | 0)) h = 6; else {
  c[d >> 2] = c[a >> 2];
  c[d + 4 >> 2] = a + 24;
  c[d + 8 >> 2] = 2048;
  b = ka(220, d | 0) | 0;
  if ((b | 0) >= 1) {
   c[f >> 2] = b;
   c[g >> 2] = 0;
   b = 0;
   h = 6;
   break;
  }
  if ((b | 0) < 0 & (b | 0) != -2) {
   c[(Hi() | 0) >> 2] = 0 - b;
   b = 0;
  } else b = 0;
 } while (0);
 if ((h | 0) == 6) {
  c[g >> 2] = (e[b + 8 + (a + 24) >> 1] | 0) + b;
  c[a + 4 >> 2] = c[b + 4 + (a + 24) >> 2];
  b = a + 24 + b | 0;
 }
 i = j;
 return b | 0;
}

function Ff(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 48 | 0;
 d = k + 36 | 0;
 e = k + 32 | 0;
 g = k + 28 | 0;
 h = k + 24 | 0;
 f = k + 8 | 0;
 j = k;
 c[e >> 2] = a;
 if (!(c[e >> 2] | 0)) {
  c[d >> 2] = 0;
  b = c[d >> 2] | 0;
  i = k;
  return b | 0;
 }
 c[h >> 2] = nh(c[e >> 2] | 0) | 0;
 c[f >> 2] = b;
 while (1) {
  a = (c[f >> 2] | 0) + (4 - 1) & ~(4 - 1);
  b = c[a >> 2] | 0;
  c[f >> 2] = a + 4;
  c[g >> 2] = b;
  if (!b) break;
  c[j >> 2] = Df(c[h >> 2] | 0, c[g >> 2] | 0) | 0;
  Cj(c[h >> 2] | 0);
  c[h >> 2] = c[j >> 2];
 }
 c[d >> 2] = c[h >> 2];
 b = c[d >> 2] | 0;
 i = k;
 return b | 0;
}

function _d() {
 var b = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 f = g + 8 | 0;
 e = g;
 Dd(1468, 9384);
 b = c[367] | 0;
 if (d[9384] | 0) {
  Ed(b, a[9384] | 0, 0);
  Cd(c[323] | 0, 1);
  i = g;
  return;
 }
 if ((b | 0) < 0 | (c[367] | 0) > 127) {
  b = c[11] | 0;
  c[e >> 2] = c[367];
  c[e + 4 >> 2] = 13614;
  $i(b, 10933, e) | 0;
  e = c[12] | 0;
  c[f >> 2] = c[367];
  c[f + 4 >> 2] = 13614;
  $i(e, 10933, f) | 0;
  wc();
  Cd(c[323] | 0, 1);
  i = g;
  return;
 }
 while (1) {
  if (((c[259] | 0) + 1 | 0) <= (c[65] | 0)) break;
  Bb();
 }
 a[(c[64] | 0) + (c[259] | 0) >> 0] = c[367];
 c[259] = (c[259] | 0) + 1;
 Cd(Lc() | 0, 1);
 i = g;
 return;
}

function Nf(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 g = h;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = 0;
 a : while (1) {
  if (c[g >> 2] | 0) {
   e = 7;
   break;
  }
  while (1) {
   b = c[e >> 2] | 0;
   c[e >> 2] = b + 1;
   b = a[b >> 0] | 0;
   d = c[f >> 2] | 0;
   c[f >> 2] = d + 1;
   if ((b | 0) != (a[d >> 0] | 0)) {
    e = 7;
    break a;
   }
   if (!(a[c[e >> 2] >> 0] | 0)) break;
   if ((c[g >> 2] | 0) != 0 ? 1 : (a[c[f >> 2] >> 0] | 0) == 0) {
    e = 7;
    break a;
   }
  }
  c[g >> 2] = 1;
 }
 if ((e | 0) == 7) {
  i = h;
  return c[g >> 2] | 0;
 }
 return 0;
}

function Ed(b, e, f) {
 b = b | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0;
 k = i;
 i = i + 16 | 0;
 g = k;
 h = k + 5 | 0;
 j = k + 4 | 0;
 c[g >> 2] = b;
 a[h >> 0] = e;
 a[j >> 0] = f;
 if ((d[h >> 0] | 0 | 0) == 4) {
  i = k;
  return;
 }
 Bc(c[g >> 2] | 0, a[h >> 0] | 0);
 switch (d[j >> 0] | 0 | 0) {
 case 0:
  {
   Qi(13057, c[11] | 0) | 0;
   Qi(13057, c[12] | 0) | 0;
   break;
  }
 case 1:
  {
   Qi(13075, c[11] | 0) | 0;
   Qi(13075, c[12] | 0) | 0;
   break;
  }
 case 2:
  {
   Qi(13091, c[11] | 0) | 0;
   Qi(13091, c[12] | 0) | 0;
   break;
  }
 case 4:
 case 3:
  {
   zc();
   break;
  }
 default:
  Ac();
 }
 wc();
 i = k;
 return;
}

function ye() {
 var a = 0, b = 0;
 b = i;
 i = i + 16 | 0;
 a = b;
 c[a >> 2] = 1;
 Oc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0);
 c[332] = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 11, 0) | 0;
 if (!(c[263] | 0)) {
  Db();
  Qi(12543, c[11] | 0) | 0;
  Qi(12543, c[12] | 0) | 0;
  Yb();
  a = c[a >> 2] | 0;
  i = b;
  return a | 0;
 }
 if (d[(c[166] | 0) + (c[332] | 0) >> 0] | 0) if ((d[(c[166] | 0) + (c[332] | 0) >> 0] | 0 | 0) != 1) {
  Db();
  Qi(14415, c[11] | 0) | 0;
  Qi(14415, c[12] | 0) | 0;
  ac(c[332] | 0);
  Yb();
  a = c[a >> 2] | 0;
  i = b;
  return a | 0;
 }
 c[a >> 2] = 0;
 a = c[a >> 2] | 0;
 i = b;
 return a | 0;
}

function Pf(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 16 | 0;
 e = f + 8 | 0;
 g = f + 4 | 0;
 d = f;
 c[g >> 2] = b;
 c[d >> 2] = c[g >> 2];
 while (1) {
  g = ui((c[d >> 2] | 0) + 1 | 0, 46) | 0;
  c[d >> 2] = g;
  if (!g) {
   b = 7;
   break;
  }
  if ((a[(c[d >> 2] | 0) + -1 >> 0] | 0) != 47) continue;
  if (!(a[(c[d >> 2] | 0) + 1 >> 0] | 0)) continue;
  if ((a[(c[d >> 2] | 0) + 1 >> 0] | 0) != 47) {
   b = 6;
   break;
  }
 }
 if ((b | 0) == 6) {
  c[e >> 2] = 1;
  g = c[e >> 2] | 0;
  i = f;
  return g | 0;
 } else if ((b | 0) == 7) {
  c[e >> 2] = 0;
  g = c[e >> 2] | 0;
  i = f;
  return g | 0;
 }
 return 0;
}

function Sg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 12 | 0;
 h = g + 8 | 0;
 f = g + 4 | 0;
 d = g;
 c[e >> 2] = a;
 c[h >> 2] = b;
 c[d >> 2] = kh(12) | 0;
 c[c[d >> 2] >> 2] = c[h >> 2];
 c[(c[d >> 2] | 0) + 4 >> 2] = 0;
 c[(c[d >> 2] | 0) + 8 >> 2] = 0;
 c[f >> 2] = c[c[e >> 2] >> 2];
 while (1) {
  if (!(c[f >> 2] | 0)) break;
  if (!(c[(c[f >> 2] | 0) + 8 >> 2] | 0)) break;
  c[f >> 2] = c[(c[f >> 2] | 0) + 8 >> 2];
 }
 a = c[d >> 2] | 0;
 if (c[f >> 2] | 0) {
  c[(c[f >> 2] | 0) + 8 >> 2] = a;
  i = g;
  return;
 } else {
  c[c[e >> 2] >> 2] = a;
  i = g;
  return;
 }
}

function Ng(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 d = g + 8 | 0;
 e = g + 4 | 0;
 f = g;
 c[d >> 2] = a;
 c[f >> 2] = c[c[d >> 2] >> 2];
 a = c[d >> 2] | 0;
 c[a >> 2] = (c[a >> 2] | 0) + (c[b >> 2] | 0);
 a = mh(c[(c[d >> 2] | 0) + 4 >> 2] | 0, c[c[d >> 2] >> 2] << 2) | 0;
 c[(c[d >> 2] | 0) + 4 >> 2] = a;
 c[e >> 2] = 0;
 while (1) {
  if ((c[e >> 2] | 0) >>> 0 >= (c[b >> 2] | 0) >>> 0) break;
  c[(c[(c[d >> 2] | 0) + 4 >> 2] | 0) + ((c[f >> 2] | 0) + (c[e >> 2] | 0) << 2) >> 2] = c[(c[b + 4 >> 2] | 0) + (c[e >> 2] << 2) >> 2];
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 i = g;
 return;
}

function sh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 e = i;
 i = i + 16 | 0;
 f = e + 8 | 0;
 h = e + 4 | 0;
 g = e;
 c[f >> 2] = a;
 c[h >> 2] = b;
 c[g >> 2] = d;
 d = (c[f >> 2] | 0) + 60 | 0;
 c[d >> 2] = (c[d >> 2] | 0) + 1;
 d = mh(c[(c[f >> 2] | 0) + 56 >> 2] | 0, c[(c[f >> 2] | 0) + 60 >> 2] << 3) | 0;
 c[(c[f >> 2] | 0) + 56 >> 2] = d;
 d = nh(c[h >> 2] | 0) | 0;
 c[(c[(c[f >> 2] | 0) + 56 >> 2] | 0) + ((c[(c[f >> 2] | 0) + 60 >> 2] | 0) - 1 << 3) >> 2] = d;
 c[(c[(c[f >> 2] | 0) + 56 >> 2] | 0) + ((c[(c[f >> 2] | 0) + 60 >> 2] | 0) - 1 << 3) + 4 >> 2] = c[g >> 2];
 i = e;
 return;
}

function ad(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0;
 j = i;
 i = i + 16 | 0;
 f = j + 5 | 0;
 g = j + 4 | 0;
 h = j;
 a[f >> 0] = b;
 a[g >> 0] = e;
 c[66] = c[67];
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[f >> 0] | 0 | 0)) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[g >> 0] | 0 | 0)) e = (c[67] | 0) < (c[21] | 0); else e = 0; else e = 0;
  b = c[67] | 0;
  if (!e) break;
  c[67] = b + 1;
 }
 if ((b | 0) < (c[21] | 0)) {
  c[h >> 2] = 1;
  h = c[h >> 2] | 0;
  i = j;
  return h | 0;
 } else {
  c[h >> 2] = 0;
  h = c[h >> 2] | 0;
  i = j;
  return h | 0;
 }
 return 0;
}

function qc() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 e = i;
 i = i + 32 | 0;
 b = e + 16 | 0;
 a = e;
 if (!(d[9125] | 0)) {
  Qi(10601, c[11] | 0) | 0;
  Qi(10601, c[12] | 0) | 0;
  i = e;
  return;
 }
 if ((d[9125] | 0 | 0) == 2) {
  f = c[11] | 0;
  g = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[a >> 2] = 34;
  c[a + 4 >> 2] = g;
  c[a + 8 >> 2] = 10617;
  $i(f, 10265, a) | 0;
  a = c[12] | 0;
  f = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
  c[b >> 2] = 34;
  c[b + 4 >> 2] = f;
  c[b + 8 >> 2] = 10617;
  $i(a, 10265, b) | 0;
  i = e;
  return;
 } else {
  bc();
  i = e;
  return;
 }
}

function Kc(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = b;
 c[68] = (c[71] | 0) + 1;
 c[e >> 2] = c[(c[63] | 0) + (c[d >> 2] << 2) >> 2];
 while (1) {
  if ((c[e >> 2] | 0) >= (c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0)) break;
  a[(c[70] | 0) + (c[68] | 0) >> 0] = a[(c[64] | 0) + (c[e >> 2] | 0) >> 0] | 0;
  c[68] = (c[68] | 0) + 1;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 c[71] = (c[71] | 0) + ((c[(c[63] | 0) + ((c[d >> 2] | 0) + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[d >> 2] << 2) >> 2] | 0));
 a[(c[70] | 0) + ((c[71] | 0) + 1) >> 0] = 0;
 i = f;
 return;
}

function pd() {
 var b = 0, d = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 b = e;
 c[b >> 2] = 0;
 if ((c[273] | 0) == (c[14] | 0)) {
  oc();
  d = c[b >> 2] | 0;
  i = e;
  return d | 0;
 }
 a[(c[17] | 0) + (c[273] | 0) >> 0] = 32;
 c[273] = (c[273] | 0) + 1;
 while (1) {
  if (!((hd() | 0) != 0 ^ 1)) {
   d = 8;
   break;
  }
  if (!(yb(c[(c[338] | 0) + (c[115] << 2) >> 2] | 0) | 0)) {
   d = 6;
   break;
  }
  c[168] = (c[168] | 0) + 1;
  c[67] = 0;
 }
 if ((d | 0) == 6) {
  kc();
  d = c[b >> 2] | 0;
  i = e;
  return d | 0;
 } else if ((d | 0) == 8) {
  c[b >> 2] = 1;
  d = c[b >> 2] | 0;
  i = e;
  return d | 0;
 }
 return 0;
}

function Qf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 h = i;
 i = i + 32 | 0;
 g = h;
 d = h + 24 | 0;
 e = h + 20 | 0;
 f = h + 16 | 0;
 j = h + 12 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 c[f >> 2] = ej(c[d >> 2] | 0, c[e >> 2] | 0) | 0;
 c[j >> 2] = c[736];
 if (!(c[(c[j >> 2] | 0) + 44 >> 2] & 4)) {
  j = c[f >> 2] | 0;
  i = h;
  return j | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 j = c[1840] | 0;
 a = c[e >> 2] | 0;
 b = c[f >> 2] | 0;
 c[g >> 2] = c[d >> 2];
 c[g + 4 >> 2] = a;
 c[g + 8 >> 2] = b;
 $i(j, 20496, g) | 0;
 ij(c[1840] | 0) | 0;
 j = c[f >> 2] | 0;
 i = h;
 return j | 0;
}

function xi(b, c) {
 b = b | 0;
 c = c | 0;
 var e = 0, f = 0, g = 0;
 e = a[b >> 0] | 0;
 a : do if (!(e << 24 >> 24)) b = 0; else {
  g = e;
  f = e & 255;
  while (1) {
   e = a[c >> 0] | 0;
   if (!(e << 24 >> 24)) {
    b = g;
    break a;
   }
   if (g << 24 >> 24 != e << 24 >> 24) {
    g = ii(f) | 0;
    if ((g | 0) != (ii(d[c >> 0] | 0) | 0)) break;
   }
   b = b + 1 | 0;
   c = c + 1 | 0;
   e = a[b >> 0] | 0;
   if (!(e << 24 >> 24)) {
    b = 0;
    break a;
   } else {
    g = e;
    f = e & 255;
   }
  }
  b = a[b >> 0] | 0;
 } while (0);
 g = ii(b & 255) | 0;
 return g - (ii(d[c >> 0] | 0) | 0) | 0;
}

function zj(a, b, d, e, f) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0;
 j = i;
 i = i + 256 | 0;
 h = j;
 do if ((d | 0) > (e | 0) & (f & 73728 | 0) == 0) {
  f = d - e | 0;
  Jj(h | 0, b | 0, (f >>> 0 > 256 ? 256 : f) | 0) | 0;
  b = c[a >> 2] | 0;
  g = (b & 32 | 0) == 0;
  if (f >>> 0 > 255) {
   e = d - e | 0;
   do {
    if (g) {
     Ii(h, 256, a) | 0;
     b = c[a >> 2] | 0;
    }
    f = f + -256 | 0;
    g = (b & 32 | 0) == 0;
   } while (f >>> 0 > 255);
   if (g) f = e & 255; else break;
  } else if (!g) break;
  Ii(h, f, a) | 0;
 } while (0);
 i = j;
 return;
}

function yf(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0;
 j = i;
 i = i + 32 | 0;
 f = j + 12 | 0;
 k = j + 8 | 0;
 g = j + 4 | 0;
 h = j;
 c[j + 16 >> 2] = b;
 c[f >> 2] = d;
 c[k >> 2] = e;
 c[g >> 2] = (a[c[f >> 2] >> 0] | 0) == 47 & 1;
 if (c[k >> 2] | 0) if ((a[c[f >> 2] >> 0] | 0) == 46) if ((a[(c[f >> 2] | 0) + 1 >> 0] | 0) == 47) f = 1; else if ((a[(c[f >> 2] | 0) + 1 >> 0] | 0) == 46) f = (a[(c[f >> 2] | 0) + 2 >> 0] | 0) == 47; else f = 0; else f = 0; else f = 0;
 c[h >> 2] = f & 1;
 i = j;
 return ((c[g >> 2] | 0) != 0 ? 1 : (c[h >> 2] | 0) != 0) & 1 | 0;
}

function Lb(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Qi(9799, c[11] | 0) | 0;
 Qi(9799, c[12] | 0) | 0;
 switch (c[d >> 2] | 0) {
 case 0:
  {
   Qi(9821, c[11] | 0) | 0;
   Qi(9821, c[12] | 0) | 0;
   d = c[11] | 0;
   Qi(9863, d) | 0;
   d = c[12] | 0;
   Qi(9863, d) | 0;
   i = b;
   return;
  }
 case 1:
  {
   Qi(9826, c[11] | 0) | 0;
   Qi(9826, c[12] | 0) | 0;
   d = c[11] | 0;
   Qi(9863, d) | 0;
   d = c[12] | 0;
   Qi(9863, d) | 0;
   i = b;
   return;
  }
 default:
  {
   Qi(9832, c[11] | 0) | 0;
   Qi(9832, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
 }
}

function gj(b, e) {
 b = b | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 m = i;
 i = i + 16 | 0;
 l = m;
 k = e & 255;
 a[l >> 0] = k;
 f = b + 16 | 0;
 g = c[f >> 2] | 0;
 if (!g) if (!(Mi(b) | 0)) {
  g = c[f >> 2] | 0;
  h = 4;
 } else f = -1; else h = 4;
 do if ((h | 0) == 4) {
  h = b + 20 | 0;
  j = c[h >> 2] | 0;
  if (j >>> 0 < g >>> 0) {
   f = e & 255;
   if ((f | 0) != (a[b + 75 >> 0] | 0)) {
    c[h >> 2] = j + 1;
    a[j >> 0] = k;
    break;
   }
  }
  if ((cb[c[b + 36 >> 2] & 7](b, l, 1) | 0) == 1) f = d[l >> 0] | 0; else f = -1;
 } while (0);
 i = m;
 return f | 0;
}

function oi(b) {
 b = b | 0;
 var c = 0, d = 0, e = 0, f = 0;
 while (1) {
  c = b + 1 | 0;
  if (!(ni(a[b >> 0] | 0) | 0)) break; else b = c;
 }
 d = a[b >> 0] | 0;
 switch (d << 24 >> 24 | 0) {
 case 45:
  {
   e = 1;
   f = 5;
   break;
  }
 case 43:
  {
   e = 0;
   f = 5;
   break;
  }
 default:
  e = 0;
 }
 if ((f | 0) == 5) {
  b = c;
  d = a[c >> 0] | 0;
 }
 c = (d << 24 >> 24) + -48 | 0;
 if (c >>> 0 < 10) {
  d = b;
  b = 0;
  do {
   d = d + 1 | 0;
   b = (b * 10 | 0) - c | 0;
   c = (a[d >> 0] | 0) + -48 | 0;
  } while (c >>> 0 < 10);
 } else b = 0;
 return ((e | 0) != 0 ? b : 0 - b | 0) | 0;
}

function Kg(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 d = g + 8 | 0;
 e = g + 4 | 0;
 f = g;
 c[d >> 2] = b;
 c[f >> 2] = xh(c[d >> 2] | 0) | 0;
 if (c[f >> 2] | 0) {
  c[f >> 2] = (c[f >> 2] | 0) + -1;
  c[e >> 2] = kh((c[f >> 2] | 0) - (c[d >> 2] | 0) + 1 | 0) | 0;
  Ai(c[e >> 2] | 0, c[d >> 2] | 0, (c[f >> 2] | 0) - (c[d >> 2] | 0) | 0) | 0;
  a[(c[e >> 2] | 0) + ((c[f >> 2] | 0) - (c[d >> 2] | 0)) >> 0] = 0;
  f = c[e >> 2] | 0;
  i = g;
  return f | 0;
 } else {
  c[e >> 2] = nh(c[d >> 2] | 0) | 0;
  f = c[e >> 2] | 0;
  i = g;
  return f | 0;
 }
 return 0;
}

function Gf(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 l = i;
 i = i + 32 | 0;
 e = l + 20 | 0;
 f = l + 16 | 0;
 h = l + 12 | 0;
 k = l + 8 | 0;
 g = l + 4 | 0;
 j = l;
 c[e >> 2] = b;
 c[f >> 2] = d;
 if (!(c[(c[e >> 2] | 0) + 20 >> 2] | 0)) {
  i = l;
  return;
 }
 c[k >> 2] = nh(c[f >> 2] | 0) | 0;
 b = c[k >> 2] | 0;
 d = fh(c[k >> 2] | 0) | 0;
 c[g >> 2] = b + (d - (c[k >> 2] | 0));
 c[j >> 2] = nh(c[g >> 2] | 0) | 0;
 a[c[g >> 2] >> 0] = 0;
 c[h >> 2] = c[k >> 2];
 dg((c[e >> 2] | 0) + 20 | 0, c[j >> 2] | 0, c[h >> 2] | 0);
 i = l;
 return;
}

function Id() {
 var a = 0, b = 0, d = 0, e = 0, f = 0;
 d = i;
 i = i + 32 | 0;
 b = d + 16 | 0;
 a = d;
 if (c[382] | 0) {
  e = c[11] | 0;
  f = c[382] | 0;
  c[a >> 2] = 13123;
  c[a + 4 >> 2] = f;
  c[a + 8 >> 2] = 13128;
  $i(e, 11218, a) | 0;
  a = c[12] | 0;
  e = c[382] | 0;
  c[b >> 2] = 13123;
  c[b + 4 >> 2] = e;
  c[b + 8 >> 2] = 13128;
  $i(a, 11218, b) | 0;
  Gd();
  Qi(13137, c[11] | 0) | 0;
  Qi(13137, c[12] | 0) | 0;
  wc();
 }
 if ((c[386] | 0) != (c[22] | 0)) {
  Qi(13170, c[11] | 0) | 0;
  Qi(13170, c[12] | 0) | 0;
  wb();
  xa(96, 1);
 } else {
  i = d;
  return;
 }
}

function $c(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 f = h + 4 | 0;
 g = h;
 a[f >> 0] = b;
 c[66] = c[67];
 while (1) {
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 1) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[f >> 0] | 0 | 0)) e = (c[67] | 0) < (c[21] | 0); else e = 0; else e = 0;
  b = c[67] | 0;
  if (!e) break;
  c[67] = b + 1;
 }
 if ((b | 0) < (c[21] | 0)) {
  c[g >> 2] = 1;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 } else {
  c[g >> 2] = 0;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function jj(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 do if ((b | 0) == -1) b = -1; else {
  if ((c[d + 76 >> 2] | 0) > -1) g = cj(d) | 0; else g = 0;
  if (!(c[d + 8 >> 2] | 0)) {
   if (!(Ni(d) | 0)) e = 6;
  } else e = 6;
  if ((e | 0) == 6) {
   e = d + 4 | 0;
   f = c[e >> 2] | 0;
   if (f >>> 0 > ((c[d + 44 >> 2] | 0) + -8 | 0) >>> 0) {
    f = f + -1 | 0;
    c[e >> 2] = f;
    a[f >> 0] = b;
    c[d >> 2] = c[d >> 2] & -17;
    if (!g) break;
    dj(d);
    break;
   }
  }
  if (!g) b = -1; else {
   dj(d);
   b = -1;
  }
 } while (0);
 return b | 0;
}

function Kb() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0, h = 0;
 a = i;
 i = i + 48 | 0;
 b = a + 40 | 0;
 d = a + 32 | 0;
 e = a + 16 | 0;
 f = a;
 g = c[11] | 0;
 h = c[376 + (c[72] << 2) >> 2] | 0;
 c[f >> 2] = 9772;
 c[f + 4 >> 2] = h;
 c[f + 8 >> 2] = 9781;
 $i(g, 9764, f) | 0;
 f = c[12] | 0;
 g = c[376 + (c[72] << 2) >> 2] | 0;
 c[e >> 2] = 9772;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 9781;
 $i(f, 9764, e) | 0;
 Ib();
 Eb();
 Fb();
 e = c[11] | 0;
 c[d >> 2] = 9791;
 $i(e, 16602, d) | 0;
 d = c[12] | 0;
 c[b >> 2] = 9791;
 $i(d, 16602, b) | 0;
 i = a;
 return;
}

function Vj(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 f = i;
 i = i + 16 | 0;
 j = f | 0;
 h = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
 g = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
 l = e >> 31 | ((e | 0) < 0 ? -1 : 0) << 1;
 k = ((e | 0) < 0 ? -1 : 0) >> 31 | ((e | 0) < 0 ? -1 : 0) << 1;
 a = Ij(h ^ a, g ^ b, h, g) | 0;
 b = C;
 Zj(a, b, Ij(l ^ d, k ^ e, l, k) | 0, C, j) | 0;
 e = Ij(c[j >> 2] ^ h, c[j + 4 >> 2] ^ g, h, g) | 0;
 d = C;
 i = f;
 return (C = d, e) | 0;
}

function mh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 g = h;
 d = h + 12 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 if (!(c[d >> 2] | 0)) {
  c[f >> 2] = kh(c[e >> 2] | 0) | 0;
  g = c[f >> 2] | 0;
  i = h;
  return g | 0;
 }
 c[f >> 2] = Ej(c[d >> 2] | 0, (c[e >> 2] | 0) != 0 ? c[e >> 2] | 0 : 1) | 0;
 if (!(c[f >> 2] | 0)) {
  h = c[1840] | 0;
  c[g >> 2] = c[e >> 2];
  $i(h, 29069, g) | 0;
  _a(1);
 } else {
  g = c[f >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function ij(a) {
 a = a | 0;
 var b = 0, d = 0;
 do if (!a) {
  if (!(c[1839] | 0)) b = 0; else b = ij(c[1839] | 0) | 0;
  Sa(7392);
  a = c[1847] | 0;
  if (a) do {
   if ((c[a + 76 >> 2] | 0) > -1) d = cj(a) | 0; else d = 0;
   if ((c[a + 20 >> 2] | 0) >>> 0 > (c[a + 28 >> 2] | 0) >>> 0) b = uj(a) | 0 | b;
   if (d) dj(a);
   a = c[a + 56 >> 2] | 0;
  } while ((a | 0) != 0);
  Oa(7392);
 } else {
  if ((c[a + 76 >> 2] | 0) <= -1) {
   b = uj(a) | 0;
   break;
  }
  d = (cj(a) | 0) == 0;
  b = uj(a) | 0;
  if (!d) dj(a);
 } while (0);
 return b | 0;
}

function Zf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 f = i;
 i = i + 176 | 0;
 k = f + 164 | 0;
 j = f + 160 | 0;
 d = f + 84 | 0;
 e = f + 8 | 0;
 h = f + 4 | 0;
 g = f;
 c[k >> 2] = a;
 c[j >> 2] = b;
 c[h >> 2] = Uh(c[k >> 2] | 0, d) | 0;
 c[g >> 2] = Uh(c[j >> 2] | 0, e) | 0;
 if (!((c[h >> 2] | 0) == 0 & (c[g >> 2] | 0) == 0)) {
  k = 0;
  i = f;
  return k | 0;
 }
 if ((c[d + 72 >> 2] | 0) == (c[e + 72 >> 2] | 0)) a = (c[d >> 2] | 0) == (c[e >> 2] | 0); else a = 0;
 k = a & 1;
 i = f;
 return k | 0;
}

function _g(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0;
 h = i;
 i = i + 16 | 0;
 j = h + 8 | 0;
 f = h + 4 | 0;
 e = h;
 c[j >> 2] = b;
 c[e >> 2] = nh(c[j >> 2] | 0) | 0;
 c[f >> 2] = c[e >> 2];
 while (1) {
  if (!(a[c[f >> 2] >> 0] | 0)) break;
  if (hi(a[c[f >> 2] >> 0] | 0) | 0) if (ji(d[c[f >> 2] >> 0] | 0) | 0) b = ki(d[c[f >> 2] >> 0] | 0) | 0; else g = 6; else g = 6;
  if ((g | 0) == 6) {
   g = 0;
   b = a[c[f >> 2] >> 0] | 0;
  }
  a[c[f >> 2] >> 0] = b;
  c[f >> 2] = (c[f >> 2] | 0) + 1;
 }
 i = h;
 return c[e >> 2] | 0;
}

function zh(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0;
 f = i;
 i = i + 32 | 0;
 j = f + 16 | 0;
 h = f + 12 | 0;
 g = f;
 c[j >> 2] = d;
 c[h >> 2] = e;
 c[g + 4 >> 2] = 75 > (c[h >> 2] | 0) >>> 0 ? 75 : (c[h >> 2] | 0) + 1 | 0;
 c[g >> 2] = kh(c[g + 4 >> 2] | 0) | 0;
 Ai(c[g >> 2] | 0, c[j >> 2] | 0, c[h >> 2] | 0) | 0;
 a[(c[g >> 2] | 0) + (c[h >> 2] | 0) >> 0] = 0;
 c[g + 8 >> 2] = (c[h >> 2] | 0) + 1;
 c[b >> 2] = c[g >> 2];
 c[b + 4 >> 2] = c[g + 4 >> 2];
 c[b + 8 >> 2] = c[g + 8 >> 2];
 i = f;
 return;
}

function Yc(b, d, e, f) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 f = f | 0;
 var g = 0, h = 0, j = 0, k = 0, l = 0;
 g = i;
 i = i + 16 | 0;
 l = g + 8 | 0;
 k = g + 12 | 0;
 j = g + 4 | 0;
 h = g;
 c[l >> 2] = b;
 a[k >> 0] = d;
 c[j >> 2] = e;
 c[h >> 2] = f;
 Rc(c[l >> 2] | 0, a[k >> 0] | 0, 11);
 c[c[j >> 2] >> 2] = c[268];
 a[(c[166] | 0) + (c[c[j >> 2] >> 2] | 0) >> 0] = 0;
 c[(c[271] | 0) + (c[c[j >> 2] >> 2] << 2) >> 2] = c[h >> 2];
 c[884 + (c[h >> 2] << 2) >> 2] = c[c[j >> 2] >> 2];
 c[732 + (c[h >> 2] << 2) >> 2] = 0;
 i = g;
 return;
}

function cf(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0;
 j = i;
 i = i + 32 | 0;
 l = j + 16 | 0;
 k = j + 12 | 0;
 f = j + 8 | 0;
 g = j + 4 | 0;
 h = j;
 c[l >> 2] = a;
 c[k >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = e;
 c[h >> 2] = (c[l >> 2] | 0) + 132 + ((c[k >> 2] | 0) * 68 | 0);
 if ((c[g >> 2] | 0) >>> 0 < (c[(c[h >> 2] | 0) + 60 >> 2] | 0) >>> 0) {
  i = j;
  return;
 }
 c[(c[h >> 2] | 0) + 56 >> 2] = c[f >> 2];
 c[(c[h >> 2] | 0) + 60 >> 2] = c[g >> 2];
 i = j;
 return;
}

function uj(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0, h = 0;
 g = a + 20 | 0;
 h = a + 28 | 0;
 if ((c[g >> 2] | 0) >>> 0 > (c[h >> 2] | 0) >>> 0) {
  cb[c[a + 36 >> 2] & 7](a, 0, 0) | 0;
  if (!(c[g >> 2] | 0)) b = -1; else d = 3;
 } else d = 3;
 if ((d | 0) == 3) {
  f = a + 4 | 0;
  b = c[f >> 2] | 0;
  d = a + 8 | 0;
  e = c[d >> 2] | 0;
  if (b >>> 0 < e >>> 0) cb[c[a + 40 >> 2] & 7](a, b - e | 0, 1) | 0;
  c[a + 16 >> 2] = 0;
  c[h >> 2] = 0;
  c[g >> 2] = 0;
  c[d >> 2] = 0;
  c[f >> 2] = 0;
  b = 0;
 }
 return b | 0;
}

function fd() {
 var a = 0, b = 0;
 b = i;
 i = i + 16 | 0;
 a = b;
 c[66] = c[67];
 c[330] = 0;
 while (1) {
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) != 3) break;
  if ((c[67] | 0) >= (c[21] | 0)) break;
  c[330] = ((c[330] | 0) * 10 | 0) + ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) - 48);
  c[67] = (c[67] | 0) + 1;
 }
 if (!((c[67] | 0) - (c[66] | 0) | 0)) {
  c[a >> 2] = 0;
  a = c[a >> 2] | 0;
  i = b;
  return a | 0;
 } else {
  c[a >> 2] = 1;
  a = c[a >> 2] | 0;
  i = b;
  return a | 0;
 }
 return 0;
}

function $f(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 b = e + 12 | 0;
 d = e + 8 | 0;
 f = e;
 c[b >> 2] = a;
 a = ef(c[b >> 2] | 0, 11) | 0;
 c[(c[b >> 2] | 0) + 72 >> 2] = a;
 c[d >> 2] = rg(c[b >> 2] | 0, c[(c[b >> 2] | 0) + 72 >> 2] | 0, 20578) | 0;
 a = (c[b >> 2] | 0) + 64 | 0;
 cg(f, 4001);
 c[a >> 2] = c[f >> 2];
 c[a + 4 >> 2] = c[f + 4 >> 2];
 while (1) {
  if (!(c[c[d >> 2] >> 2] | 0)) break;
  ag(c[b >> 2] | 0, c[c[d >> 2] >> 2] | 0);
  c[d >> 2] = (c[d >> 2] | 0) + 4;
 }
 i = e;
 return;
}

function Kd(b) {
 b = b | 0;
 var d = 0, e = 0;
 d = i;
 i = i + 16 | 0;
 e = d;
 c[e >> 2] = b;
 c[260] = c[(c[63] | 0) + (c[e >> 2] << 2) >> 2];
 c[261] = c[(c[63] | 0) + ((c[e >> 2] | 0) + 1 << 2) >> 2];
 if (((c[355] | 0) + ((c[261] | 0) - (c[260] | 0)) | 0) > (c[14] | 0)) xb();
 c[273] = c[355];
 while (1) {
  if ((c[260] | 0) >= (c[261] | 0)) break;
  a[(c[17] | 0) + (c[273] | 0) >> 0] = a[(c[64] | 0) + (c[260] | 0) >> 0] | 0;
  c[273] = (c[273] | 0) + 1;
  c[260] = (c[260] | 0) + 1;
 }
 c[355] = c[273];
 i = d;
 return;
}

function Pj(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0;
 if ((e | 0) >= 4096) return Ha(b | 0, d | 0, e | 0) | 0;
 f = b | 0;
 if ((b & 3) == (d & 3)) {
  while (b & 3) {
   if (!e) return f | 0;
   a[b >> 0] = a[d >> 0] | 0;
   b = b + 1 | 0;
   d = d + 1 | 0;
   e = e - 1 | 0;
  }
  while ((e | 0) >= 4) {
   c[b >> 2] = c[d >> 2];
   b = b + 4 | 0;
   d = d + 4 | 0;
   e = e - 4 | 0;
  }
 }
 while ((e | 0) > 0) {
  a[b >> 0] = a[d >> 0] | 0;
  b = b + 1 | 0;
  d = d + 1 | 0;
  e = e - 1 | 0;
 }
 return f | 0;
}

function Lc() {
 var a = 0, b = 0, d = 0, e = 0;
 e = i;
 i = i + 32 | 0;
 d = e + 8 | 0;
 b = e;
 a = e + 16 | 0;
 if ((c[22] | 0) == (c[23] | 0)) {
  vb();
  e = c[11] | 0;
  a = c[23] | 0;
  c[b >> 2] = 11381;
  c[b + 4 >> 2] = a;
  $i(e, 11369, b) | 0;
  e = c[12] | 0;
  b = c[23] | 0;
  c[d >> 2] = 11381;
  c[d + 4 >> 2] = b;
  $i(e, 11369, d) | 0;
  xa(96, 1);
 } else {
  c[22] = (c[22] | 0) + 1;
  c[(c[63] | 0) + (c[22] << 2) >> 2] = c[259];
  c[a >> 2] = (c[22] | 0) - 1;
  i = e;
  return c[a >> 2] | 0;
 }
 return 0;
}

function hh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 g = h;
 d = h + 12 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 if (!((c[d >> 2] | 0) != 0 & (c[e >> 2] | 0) != 0)) za(28905, 28922, 30, 28978);
 c[f >> 2] = Qf(c[d >> 2] | 0, c[e >> 2] | 0) | 0;
 if (!(c[f >> 2] | 0)) {
  h = c[1840] | 0;
  c[g >> 2] = c[(c[736] | 0) + 104 >> 2];
  $i(h, 28995, g) | 0;
  Li(c[d >> 2] | 0);
  _a(1);
 } else {
  i = h;
  return c[f >> 2] | 0;
 }
 return 0;
}

function Oi(a) {
 a = a | 0;
 var b = 0, e = 0, f = 0;
 if ((c[a + 76 >> 2] | 0) < 0) f = 3; else if (!(cj(a) | 0)) f = 3; else {
  b = a + 4 | 0;
  e = c[b >> 2] | 0;
  if (e >>> 0 < (c[a + 8 >> 2] | 0) >>> 0) {
   c[b >> 2] = e + 1;
   b = d[e >> 0] | 0;
  } else b = hj(a) | 0;
  dj(a);
 }
 do if ((f | 0) == 3) {
  b = a + 4 | 0;
  e = c[b >> 2] | 0;
  if (e >>> 0 < (c[a + 8 >> 2] | 0) >>> 0) {
   c[b >> 2] = e + 1;
   b = d[e >> 0] | 0;
   break;
  } else {
   b = hj(a) | 0;
   break;
  }
 } while (0);
 return b | 0;
}

function Dc() {
 a : do if (c[175] | 0) {
  while (1) {
   if ((c[175] | 0) <= 0) break;
   if ((d[8613 + (d[(c[18] | 0) + ((c[175] | 0) - 1) >> 0] | 0) >> 0] | 0 | 0) != 1) break;
   c[175] = (c[175] | 0) - 1;
  }
  if (!(c[175] | 0)) return;
  c[176] = 0;
  while (1) {
   if ((c[176] | 0) >= (c[175] | 0)) break a;
   Vi(d[8869 + (d[(c[18] | 0) + (c[176] | 0) >> 0] | 0) >> 0] | 0, c[177] | 0) | 0;
   c[176] = (c[176] | 0) + 1;
  }
 } while (0);
 Vi(10, c[177] | 0) | 0;
 c[178] = (c[178] | 0) + 1;
 c[175] = 0;
 return;
}

function Ye() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
 e = i;
 i = i + 48 | 0;
 d = e + 8 | 0;
 g = e;
 a = e + 16 | 0;
 f = e + 20 | 0;
 b = e + 12 | 0;
 c[g >> 2] = Wh() | 0;
 Xi(f, 20809, g) | 0;
 c[729] = Ef(c[765] | 0, f, 16053) | 0;
 if (c[722] | 0) {
  c[b >> 2] = Ef(c[722] | 0, 29173, c[729] | 0) | 0;
  Cj(c[729] | 0);
  c[729] = c[b >> 2];
 }
 c[728] = hh(c[729] | 0, 16058) | 0;
 c[a >> 2] = jh() | 0;
 g = c[728] | 0;
 c[d >> 2] = c[a >> 2];
 $i(g, 16061, d) | 0;
 Cj(c[a >> 2] | 0);
 i = e;
 return;
}

function yj(b, c, d) {
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0;
 if (c >>> 0 > 0 | (c | 0) == 0 & b >>> 0 > 4294967295) while (1) {
  e = Yj(b | 0, c | 0, 10, 0) | 0;
  d = d + -1 | 0;
  a[d >> 0] = e | 48;
  e = Xj(b | 0, c | 0, 10, 0) | 0;
  if (c >>> 0 > 9 | (c | 0) == 9 & b >>> 0 > 4294967295) {
   b = e;
   c = C;
  } else {
   b = e;
   break;
  }
 }
 if (b) while (1) {
  d = d + -1 | 0;
  a[d >> 0] = (b >>> 0) % 10 | 0 | 48;
  if (b >>> 0 < 10) break; else b = (b >>> 0) / 10 | 0;
 }
 return d | 0;
}

function Mh(a, b) {
 a = +a;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 h[k >> 3] = a;
 d = c[k >> 2] | 0;
 e = c[k + 4 >> 2] | 0;
 f = Nj(d | 0, e | 0, 52) | 0;
 f = f & 2047;
 switch (f | 0) {
 case 0:
  {
   if (a != 0.0) {
    a = +Mh(a * 18446744073709551616.0, b);
    d = (c[b >> 2] | 0) + -64 | 0;
   } else d = 0;
   c[b >> 2] = d;
   break;
  }
 case 2047:
  break;
 default:
  {
   c[b >> 2] = f + -1022;
   c[k >> 2] = d;
   c[k + 4 >> 2] = e & -2146435073 | 1071644672;
   a = +h[k >> 3];
  }
 }
 return +a;
}

function Rf(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 32 | 0;
 e = f;
 b = f + 16 | 0;
 d = f + 12 | 0;
 g = f + 8 | 0;
 c[b >> 2] = a;
 c[d >> 2] = Ti(c[b >> 2] | 0) | 0;
 c[g >> 2] = c[736];
 if (!(c[(c[g >> 2] | 0) + 44 >> 2] & 4)) {
  g = c[d >> 2] | 0;
  i = f;
  return g | 0;
 }
 Qi(29466, c[1840] | 0) | 0;
 g = c[1840] | 0;
 a = c[d >> 2] | 0;
 c[e >> 2] = c[b >> 2];
 c[e + 4 >> 2] = a;
 $i(g, 20520, e) | 0;
 ij(c[1840] | 0) | 0;
 g = c[d >> 2] | 0;
 i = f;
 return g | 0;
}

function si(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = b;
 a : do if (!(f & 3)) e = 4; else {
  d = b;
  b = f;
  while (1) {
   if (!(a[d >> 0] | 0)) break a;
   d = d + 1 | 0;
   b = d;
   if (!(b & 3)) {
    b = d;
    e = 4;
    break;
   }
  }
 } while (0);
 if ((e | 0) == 4) {
  while (1) {
   d = c[b >> 2] | 0;
   if (!((d & -2139062144 ^ -2139062144) & d + -16843009)) b = b + 4 | 0; else break;
  }
  if ((d & 255) << 24 >> 24) do b = b + 1 | 0; while ((a[b >> 0] | 0) != 0);
 }
 return b - f | 0;
}

function Ej(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0;
 if (!a) {
  a = Bj(b) | 0;
  return a | 0;
 }
 if (b >>> 0 > 4294967231) {
  c[(Hi() | 0) >> 2] = 12;
  a = 0;
  return a | 0;
 }
 d = Fj(a + -8 | 0, b >>> 0 < 11 ? 16 : b + 11 & -8) | 0;
 if (d) {
  a = d + 8 | 0;
  return a | 0;
 }
 d = Bj(b) | 0;
 if (!d) {
  a = 0;
  return a | 0;
 }
 e = c[a + -4 >> 2] | 0;
 e = (e & -8) - ((e & 3 | 0) == 0 ? 8 : 4) | 0;
 Pj(d | 0, a | 0, (e >>> 0 < b >>> 0 ? e : b) | 0) | 0;
 Cj(a);
 a = d;
 return a | 0;
}

function wg(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0, k = 0;
 h = i;
 i = i + 32 | 0;
 k = h + 28 | 0;
 e = h + 24 | 0;
 g = h + 16 | 0;
 f = h + 8 | 0;
 j = h;
 c[k >> 2] = b;
 c[e >> 2] = d;
 c[f >> 2] = Jg(c[k >> 2] | 0, c[e >> 2] | 0) | 0;
 sg(j);
 c[g >> 2] = c[j >> 2];
 c[g + 4 >> 2] = c[j + 4 >> 2];
 if ((c[e >> 2] | 0) != (c[f >> 2] | 0)) Cj(c[e >> 2] | 0);
 Lg(g, c[f >> 2] | 0);
 c[a >> 2] = c[g >> 2];
 c[a + 4 >> 2] = c[g + 4 >> 2];
 i = h;
 return;
}

function hc() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 32 | 0;
 f = g + 24 | 0;
 e = g + 16 | 0;
 d = g + 8 | 0;
 b = g;
 Vi(45, c[11] | 0) | 0;
 Vi(45, c[12] | 0) | 0;
 gc();
 Eb();
 Fb();
 a = c[11] | 0;
 if (c[169] | 0) {
  c[b >> 2] = 9791;
  $i(a, 16602, b) | 0;
  f = c[12] | 0;
  c[d >> 2] = 9791;
  $i(f, 16602, d) | 0;
  i = g;
  return;
 } else {
  c[e >> 2] = 10410;
  $i(a, 16602, e) | 0;
  e = c[12] | 0;
  c[f >> 2] = 10410;
  $i(e, 16602, f) | 0;
  i = g;
  return;
 }
}

function _c(b) {
 b = b | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 f = h + 4 | 0;
 g = h;
 a[f >> 0] = b;
 c[66] = c[67];
 while (1) {
  if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != (d[f >> 0] | 0 | 0)) e = (c[67] | 0) < (c[21] | 0); else e = 0;
  b = c[67] | 0;
  if (!e) break;
  c[67] = b + 1;
 }
 if ((b | 0) < (c[21] | 0)) {
  c[g >> 2] = 1;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 } else {
  c[g >> 2] = 0;
  g = c[g >> 2] | 0;
  i = h;
  return g | 0;
 }
 return 0;
}

function Vd() {
 var b = 0;
 Dd(1468, 9384);
 b = c[367] | 0;
 if ((d[9384] | 0 | 0) != 1) {
  Ed(b, a[9384] | 0, 1);
  Cd(0, 0);
  return;
 }
 if (((c[(c[63] | 0) + (b + 1 << 2) >> 2] | 0) - (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) | 0) != 1) {
  Vi(34, c[11] | 0) | 0;
  Vi(34, c[12] | 0) | 0;
  Ab(c[367] | 0);
  Qi(13389, c[11] | 0) | 0;
  Qi(13389, c[12] | 0) | 0;
  wc();
  Cd(0, 0);
  return;
 } else {
  Cd(d[(c[64] | 0) + (c[(c[63] | 0) + (c[367] << 2) >> 2] | 0) >> 0] | 0, 0);
  return;
 }
}

function Pe(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 e = f + 8 | 0;
 b = f + 4 | 0;
 d = f;
 c[b >> 2] = a;
 if (Yi(c[b >> 2] | 0) | 0) {
  c[e >> 2] = 1;
  e = c[e >> 2] | 0;
  i = f;
  return e | 0;
 }
 c[d >> 2] = Oi(c[b >> 2] | 0) | 0;
 if ((c[d >> 2] | 0) != -1) jj(c[d >> 2] | 0, c[b >> 2] | 0) | 0;
 if ((c[d >> 2] | 0) == 10 | (c[d >> 2] | 0) == 13) b = 1; else b = (c[d >> 2] | 0) == -1;
 c[e >> 2] = b & 1;
 e = c[e >> 2] | 0;
 i = f;
 return e | 0;
}

function qi(b, c, e) {
 b = b | 0;
 c = c | 0;
 e = e | 0;
 var f = 0, g = 0;
 if (!e) c = 0; else {
  f = a[b >> 0] | 0;
  a : do if (!(f << 24 >> 24)) f = 0; else while (1) {
   e = e + -1 | 0;
   g = a[c >> 0] | 0;
   if (!(f << 24 >> 24 == g << 24 >> 24 & ((e | 0) != 0 & g << 24 >> 24 != 0))) break a;
   b = b + 1 | 0;
   c = c + 1 | 0;
   f = a[b >> 0] | 0;
   if (!(f << 24 >> 24)) {
    f = 0;
    break;
   }
  } while (0);
  c = (f & 255) - (d[c >> 0] | 0) | 0;
 }
 return c | 0;
}

function Df(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0, j = 0;
 e = i;
 i = i + 32 | 0;
 h = e + 16 | 0;
 f = e + 12 | 0;
 g = e + 8 | 0;
 j = e + 4 | 0;
 d = e;
 c[h >> 2] = a;
 c[f >> 2] = b;
 c[g >> 2] = si(c[h >> 2] | 0) | 0;
 c[j >> 2] = si(c[f >> 2] | 0) | 0;
 c[d >> 2] = kh((c[g >> 2] | 0) + (c[j >> 2] | 0) + 1 | 0) | 0;
 zi(c[d >> 2] | 0, c[h >> 2] | 0) | 0;
 pi((c[d >> 2] | 0) + (c[g >> 2] | 0) | 0, c[f >> 2] | 0) | 0;
 i = e;
 return c[d >> 2] | 0;
}

function Ni(b) {
 b = b | 0;
 var d = 0, e = 0;
 d = b + 74 | 0;
 e = a[d >> 0] | 0;
 a[d >> 0] = e + 255 | e;
 d = b + 20 | 0;
 e = b + 44 | 0;
 if ((c[d >> 2] | 0) >>> 0 > (c[e >> 2] | 0) >>> 0) cb[c[b + 36 >> 2] & 7](b, 0, 0) | 0;
 c[b + 16 >> 2] = 0;
 c[b + 28 >> 2] = 0;
 c[d >> 2] = 0;
 d = c[b >> 2] | 0;
 if (!(d & 20)) {
  d = c[e >> 2] | 0;
  c[b + 8 >> 2] = d;
  c[b + 4 >> 2] = d;
  d = 0;
 } else if (!(d & 4)) d = -1; else {
  c[b >> 2] = d | 32;
  d = -1;
 }
 return d | 0;
}

function ej(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 32 | 0;
 f = g + 16 | 0;
 e = g;
 if (!(ti(31441, a[d >> 0] | 0, 4) | 0)) {
  c[(Hi() | 0) >> 2] = 22;
  b = 0;
 } else {
  h = fj(d) | 0 | 32768;
  c[e >> 2] = b;
  c[e + 4 >> 2] = h;
  c[e + 8 >> 2] = 438;
  e = rj(Ua(5, e | 0) | 0) | 0;
  if ((e | 0) < 0) b = 0; else {
   b = bj(e, d) | 0;
   if (!b) {
    c[f >> 2] = e;
    Ta(6, f | 0) | 0;
    b = 0;
   }
  }
 }
 i = g;
 return b | 0;
}

function Uj(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, i = 0, j = 0;
 j = b >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
 i = ((b | 0) < 0 ? -1 : 0) >> 31 | ((b | 0) < 0 ? -1 : 0) << 1;
 f = d >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
 e = ((d | 0) < 0 ? -1 : 0) >> 31 | ((d | 0) < 0 ? -1 : 0) << 1;
 h = Ij(j ^ a, i ^ b, j, i) | 0;
 g = C;
 a = f ^ j;
 b = e ^ i;
 return Ij((Zj(h, g, Ij(f ^ c, e ^ d, f, e) | 0, C, 0) | 0) ^ a, C ^ b, a, b) | 0;
}

function ve() {
 var a = 0;
 c[67] = 0;
 if (!(_c(123) | 0)) return;
 a = Qc(c[15] | 0, c[66] | 0, (c[67] | 0) - (c[66] | 0) | 0, 2, 0) | 0;
 c[343] = c[(c[271] | 0) + (a << 2) >> 2];
 if (!(c[263] | 0)) return;
 switch (c[343] | 0) {
 case 0:
  {
   qe();
   return;
  }
 case 1:
  {
   re();
   return;
  }
 case 2:
  {
   se();
   return;
  }
 case 3:
  {
   te();
   return;
  }
 default:
  {
   Qi(14229, c[11] | 0) | 0;
   Qi(14229, c[12] | 0) | 0;
   wb();
   xa(96, 1);
  }
 }
}

function Gi(b) {
 b = b | 0;
 var c = 0, e = 0;
 c = 0;
 while (1) {
  if ((d[29549 + c >> 0] | 0) == (b | 0)) {
   e = 2;
   break;
  }
  c = c + 1 | 0;
  if ((c | 0) == 87) {
   c = 87;
   b = 29637;
   e = 5;
   break;
  }
 }
 if ((e | 0) == 2) if (!c) b = 29637; else {
  b = 29637;
  e = 5;
 }
 if ((e | 0) == 5) while (1) {
  e = b;
  while (1) {
   b = e + 1 | 0;
   if (!(a[e >> 0] | 0)) break; else e = b;
  }
  c = c + -1 | 0;
  if (!c) break; else e = 5;
 }
 return b | 0;
}

function Fg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 g = h;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = si(c[e >> 2] | 0) | 0;
 if ((c[g >> 2] | 0) > 0) if ((a[(c[e >> 2] | 0) + ((c[g >> 2] | 0) - 1) >> 0] | 0) != 47) {
  a[(c[e >> 2] | 0) + (c[g >> 2] | 0) >> 0] = 47;
  a[(c[e >> 2] | 0) + ((c[g >> 2] | 0) + 1) >> 0] = 0;
 }
 g = c[e >> 2] | 0;
 pi(g, Ig(c[f >> 2] | 0) | 0) | 0;
 i = h;
 return;
}

function cg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 32 | 0;
 g = f + 16 | 0;
 e = f + 8 | 0;
 d = f;
 c[g >> 2] = b;
 c[e >> 2] = kh(c[g >> 2] << 2) | 0;
 c[e + 4 >> 2] = c[g >> 2];
 c[d >> 2] = 0;
 while (1) {
  if ((c[d >> 2] | 0) >>> 0 >= (c[e + 4 >> 2] | 0) >>> 0) break;
  c[(c[e >> 2] | 0) + (c[d >> 2] << 2) >> 2] = 0;
  c[d >> 2] = (c[d >> 2] | 0) + 1;
 }
 c[a >> 2] = c[e >> 2];
 c[a + 4 >> 2] = c[e + 4 >> 2];
 i = f;
 return;
}

function Jj(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, i = 0;
 f = b + e | 0;
 if ((e | 0) >= 20) {
  d = d & 255;
  h = b & 3;
  i = d | d << 8 | d << 16 | d << 24;
  g = f & ~3;
  if (h) {
   h = b + 4 - h | 0;
   while ((b | 0) < (h | 0)) {
    a[b >> 0] = d;
    b = b + 1 | 0;
   }
  }
  while ((b | 0) < (g | 0)) {
   c[b >> 2] = i;
   b = b + 4 | 0;
  }
 }
 while ((b | 0) < (f | 0)) {
  a[b >> 0] = d;
  b = b + 1 | 0;
 }
 return b - e | 0;
}

function Oe(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f + 8 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = a;
 do if (c[d >> 2] | 0) {
  if (Yi(c[d >> 2] | 0) | 0) {
   c[b >> 2] = 1;
   break;
  }
  a = Oi(c[d >> 2] | 0) | 0;
  c[e >> 2] = a;
  if ((a | 0) == -1) {
   c[b >> 2] = 1;
   break;
  } else {
   jj(c[e >> 2] | 0, c[d >> 2] | 0) | 0;
   c[b >> 2] = 0;
   break;
  }
 } else c[b >> 2] = 1; while (0);
 i = f;
 return c[b >> 2] | 0;
}

function qg(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 g = i;
 i = i + 32 | 0;
 m = g + 20 | 0;
 l = g + 16 | 0;
 k = g + 12 | 0;
 j = g + 8 | 0;
 h = g + 4 | 0;
 f = g;
 c[m >> 2] = a;
 c[l >> 2] = b;
 c[k >> 2] = d;
 c[j >> 2] = e;
 c[h >> 2] = vg(c[m >> 2] | 0, c[l >> 2] | 0, c[k >> 2] | 0, c[j >> 2] | 0, 0) | 0;
 c[f >> 2] = c[c[h >> 2] >> 2];
 Cj(c[h >> 2] | 0);
 i = g;
 return c[f >> 2] | 0;
}

function gf(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0, l = 0, m = 0;
 g = i;
 i = i + 32 | 0;
 m = g + 20 | 0;
 l = g + 16 | 0;
 k = g + 12 | 0;
 j = g + 8 | 0;
 h = g + 4 | 0;
 f = g;
 c[m >> 2] = a;
 c[l >> 2] = b;
 c[k >> 2] = d;
 c[j >> 2] = e;
 c[h >> 2] = hf(c[m >> 2] | 0, c[l >> 2] | 0, c[k >> 2] | 0, c[j >> 2] | 0, 0) | 0;
 c[f >> 2] = c[c[h >> 2] >> 2];
 Cj(c[h >> 2] | 0);
 i = g;
 return c[f >> 2] | 0;
}

function id() {
 var a = 0, b = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 a = e;
 while (1) {
  if (hd() | 0) if ((d[(c[15] | 0) + (c[67] | 0) >> 0] | 0 | 0) != 37) {
   b = 4;
   break;
  }
  if (!(yb(c[126] | 0) | 0)) {
   b = 6;
   break;
  }
  c[125] = (c[125] | 0) + 1;
  c[67] = 0;
 }
 if ((b | 0) == 4) {
  c[a >> 2] = 1;
  b = c[a >> 2] | 0;
  i = e;
  return b | 0;
 } else if ((b | 0) == 6) {
  c[a >> 2] = 0;
  b = c[a >> 2] | 0;
  i = e;
  return b | 0;
 }
 return 0;
}

function Ti(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 if ((c[a + 76 >> 2] | 0) > -1) cj(a) | 0;
 e = (c[a >> 2] & 1 | 0) != 0;
 if (!e) {
  Sa(7392);
  d = c[a + 52 >> 2] | 0;
  b = a + 56 | 0;
  if (d) c[d + 56 >> 2] = c[b >> 2];
  b = c[b >> 2] | 0;
  if (b) c[b + 52 >> 2] = d;
  if ((c[1847] | 0) == (a | 0)) c[1847] = b;
  Oa(7392);
 }
 b = ij(a) | 0;
 b = fb[c[a + 12 >> 2] & 3](a) | 0 | b;
 d = c[a + 92 >> 2] | 0;
 if (d) Cj(d);
 if (!e) Cj(a);
 return b | 0;
}

function Fh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = a;
 c[e >> 2] = b;
 while (1) {
  if (((c[(c[d >> 2] | 0) + 8 >> 2] | 0) + (c[e >> 2] | 0) | 0) >>> 0 <= (c[(c[d >> 2] | 0) + 4 >> 2] | 0) >>> 0) break;
  b = (c[d >> 2] | 0) + 4 | 0;
  c[b >> 2] = (c[b >> 2] | 0) + 75;
  b = mh(c[c[d >> 2] >> 2] | 0, c[(c[d >> 2] | 0) + 4 >> 2] | 0) | 0;
  c[c[d >> 2] >> 2] = b;
 }
 i = f;
 return;
}

function dd() {
 var a = 0, b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 e = f;
 c[66] = c[67];
 while (1) {
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 2) b = (c[67] | 0) < (c[21] | 0); else b = 0;
  a = c[67] | 0;
  if (!b) break;
  c[67] = a + 1;
 }
 if (!(a - (c[66] | 0) | 0)) {
  c[e >> 2] = 0;
  e = c[e >> 2] | 0;
  i = f;
  return e | 0;
 } else {
  c[e >> 2] = 1;
  e = c[e >> 2] | 0;
  i = f;
  return e | 0;
 }
 return 0;
}

function od() {
 var a = 0, b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 a = d;
 while (1) {
  if (!((hd() | 0) != 0 ^ 1)) {
   b = 6;
   break;
  }
  if (!(yb(c[(c[338] | 0) + (c[115] << 2) >> 2] | 0) | 0)) {
   b = 4;
   break;
  }
  c[168] = (c[168] | 0) + 1;
  c[67] = 0;
 }
 if ((b | 0) == 4) {
  c[a >> 2] = 0;
  b = c[a >> 2] | 0;
  i = d;
  return b | 0;
 } else if ((b | 0) == 6) {
  c[a >> 2] = 1;
  b = c[a >> 2] | 0;
  i = d;
  return b | 0;
 }
 return 0;
}

function kd() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 24 | 0;
 d = a + 16 | 0;
 e = a + 8 | 0;
 f = a;
 g = c[11] | 0;
 c[f >> 2] = 12457;
 $i(g, 16602, f) | 0;
 f = c[12] | 0;
 c[e >> 2] = 12457;
 $i(f, 16602, e) | 0;
 Qi(12499, c[11] | 0) | 0;
 Qi(12499, c[12] | 0) | 0;
 Db();
 e = c[11] | 0;
 c[d >> 2] = 12509;
 $i(e, 16602, d) | 0;
 d = c[12] | 0;
 c[b >> 2] = 12509;
 $i(d, 16602, b) | 0;
 jd();
 i = a;
 return;
}

function Hg(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = b;
 b = c[d >> 2] | 0;
 c[e >> 2] = b + (si(c[d >> 2] | 0) | 0);
 while (1) {
  if ((c[e >> 2] | 0) >>> 0 <= (c[d >> 2] | 0) >>> 0) break;
  if ((a[c[e >> 2] >> 0] | 0) == 47) break;
  c[e >> 2] = (c[e >> 2] | 0) + -1;
 }
 zi(25814, (c[e >> 2] | 0) + ((a[c[e >> 2] >> 0] | 0) == 47 & 1) | 0) | 0;
 a[c[e >> 2] >> 0] = 0;
 i = f;
 return 25814;
}

function md() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
 c[e >> 2] = 34;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 12567;
 $i(f, 10265, e) | 0;
 e = c[12] | 0;
 f = d[8869 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0;
 c[b >> 2] = 34;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 12567;
 $i(e, 10265, b) | 0;
 jd();
 i = a;
 return;
}

function aj(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 b = c[(Ja() | 0) + 44 >> 2] | 0;
 d = a + 76 | 0;
 e = c[d >> 2] | 0;
 do if ((e | 0) == (b | 0)) {
  b = a + 68 | 0;
  d = c[b >> 2] | 0;
  if ((d | 0) == 2147483647) b = -1; else {
   c[b >> 2] = d + 1;
   b = 0;
  }
 } else {
  if ((e | 0) < 0) c[d >> 2] = 0; else if (e) {
   b = -1;
   break;
  }
  if (!(c[d >> 2] | 0)) c[d >> 2] = b;
  c[a + 68 >> 2] = 1;
  b = 0;
 } while (0);
 return b | 0;
}

function mj(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 e = c[1838] | 0;
 if ((c[e + 76 >> 2] | 0) > -1) f = cj(e) | 0; else f = 0;
 do if ((Qi(b, e) | 0) < 0) b = 1; else {
  if ((a[e + 75 >> 0] | 0) != 10) {
   b = e + 20 | 0;
   d = c[b >> 2] | 0;
   if (d >>> 0 < (c[e + 16 >> 2] | 0) >>> 0) {
    c[b >> 2] = d + 1;
    a[d >> 0] = 10;
    b = 0;
    break;
   }
  }
  b = (gj(e, 10) | 0) < 0;
 } while (0);
 if (f) dj(e);
 return b << 31 >> 31 | 0;
}

function Sf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 f = i;
 i = i + 16 | 0;
 g = f + 12 | 0;
 h = f + 8 | 0;
 e = f + 4 | 0;
 d = f;
 c[g >> 2] = a;
 c[h >> 2] = b;
 c[e >> 2] = bh(c[g >> 2] | 0, c[h >> 2] | 0) | 0;
 c[d >> 2] = Zg(c[g >> 2] | 0, c[e >> 2] | 0) | 0;
 if ((c[d >> 2] | 0) == (c[e >> 2] | 0)) {
  h = c[d >> 2] | 0;
  i = f;
  return h | 0;
 }
 Cj(c[e >> 2] | 0);
 h = c[d >> 2] | 0;
 i = f;
 return h | 0;
}

function Mj(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0;
 p = p + 1 | 0;
 c[a >> 2] = p;
 while ((f | 0) < (e | 0)) {
  if (!(c[d + (f << 3) >> 2] | 0)) {
   c[d + (f << 3) >> 2] = p;
   c[d + ((f << 3) + 4) >> 2] = b;
   c[d + ((f << 3) + 8) >> 2] = 0;
   C = e;
   return d | 0;
  }
  f = f + 1 | 0;
 }
 e = e * 2 | 0;
 d = Ej(d | 0, 8 * (e + 1 | 0) | 0) | 0;
 d = Mj(a | 0, b | 0, d | 0, e | 0) | 0;
 C = e;
 return d | 0;
}

function hd() {
 var a = 0, b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 e = f;
 while (1) {
  if ((d[8613 + (d[(c[15] | 0) + (c[67] | 0) >> 0] | 0) >> 0] | 0 | 0) == 1) b = (c[67] | 0) < (c[21] | 0); else b = 0;
  a = c[67] | 0;
  if (!b) break;
  c[67] = a + 1;
 }
 if ((a | 0) < (c[21] | 0)) {
  c[e >> 2] = 1;
  e = c[e >> 2] | 0;
  i = f;
  return e | 0;
 } else {
  c[e >> 2] = 0;
  e = c[e >> 2] | 0;
  i = f;
  return e | 0;
 }
 return 0;
}

function Tc(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Ub(c[c[d >> 2] >> 2] | 0);
 jc(_(c[269] | 0, (c[c[d >> 2] >> 2] | 0) + 1 | 0) | 0);
 c[(c[121] | 0) + (c[c[d >> 2] >> 2] << 2) >> 2] = c[(c[167] | 0) + (c[270] << 2) >> 2];
 c[(c[271] | 0) + (c[270] << 2) >> 2] = c[c[d >> 2] >> 2];
 c[(c[271] | 0) + (c[272] << 2) >> 2] = c[270];
 c[c[d >> 2] >> 2] = (c[c[d >> 2] >> 2] | 0) + 1;
 i = b;
 return;
}

function vh(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 8 | 0;
 j = g + 4 | 0;
 h = g + 12 | 0;
 f = g;
 c[e >> 2] = b;
 c[j >> 2] = d;
 d = (si(c[j >> 2] | 0) | 0) - 1 | 0;
 a[h >> 0] = a[(c[j >> 2] | 0) + d >> 0] | 0;
 d = c[j >> 2] | 0;
 if ((a[h >> 0] | 0) == 47) d = nh(d) | 0; else d = Df(d, 29173) | 0;
 c[f >> 2] = d;
 Sg(c[e >> 2] | 0, c[f >> 2] | 0);
 i = g;
 return;
}

function Ch(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 e = i;
 i = i + 16 | 0;
 g = e + 8 | 0;
 h = e + 4 | 0;
 f = e;
 c[g >> 2] = a;
 c[h >> 2] = b;
 c[f >> 2] = d;
 Fh(c[g >> 2] | 0, c[f >> 2] | 0);
 Ai((c[c[g >> 2] >> 2] | 0) + (c[(c[g >> 2] | 0) + 8 >> 2] | 0) | 0, c[h >> 2] | 0, c[f >> 2] | 0) | 0;
 b = (c[g >> 2] | 0) + 8 | 0;
 c[b >> 2] = (c[b >> 2] | 0) + (c[f >> 2] | 0);
 i = e;
 return;
}

function bf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 e = i;
 i = i + 32 | 0;
 g = e + 8 | 0;
 f = e;
 d = e + 16 | 0;
 e = e + 12 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 c[e >> 2] = (c[e >> 2] | 0) != 0 ? b : 16588;
 while (1) {
  if (!(c[c[d >> 2] >> 2] | 0)) break;
  c[f >> 2] = c[c[d >> 2] >> 2];
  lj(16602, f) | 0;
  c[d >> 2] = (c[d >> 2] | 0) + 4;
 }
 c[g >> 2] = c[e >> 2];
 lj(16606, g) | 0;
 $e(0);
}

function Mg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 e = d + 4 | 0;
 f = d;
 c[e >> 2] = a;
 c[f >> 2] = b;
 b = c[e >> 2] | 0;
 c[b >> 2] = (c[b >> 2] | 0) + 1;
 b = mh(c[(c[e >> 2] | 0) + 4 >> 2] | 0, c[c[e >> 2] >> 2] << 2) | 0;
 c[(c[e >> 2] | 0) + 4 >> 2] = b;
 c[(c[(c[e >> 2] | 0) + 4 >> 2] | 0) + ((c[c[e >> 2] >> 2] | 0) - 1 << 2) >> 2] = c[f >> 2];
 i = d;
 return;
}

function Lg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 e = d + 4 | 0;
 f = d;
 c[e >> 2] = a;
 c[f >> 2] = b;
 b = c[e >> 2] | 0;
 c[b >> 2] = (c[b >> 2] | 0) + 1;
 b = mh(c[(c[e >> 2] | 0) + 4 >> 2] | 0, c[c[e >> 2] >> 2] << 2) | 0;
 c[(c[e >> 2] | 0) + 4 >> 2] = b;
 c[(c[(c[e >> 2] | 0) + 4 >> 2] | 0) + ((c[c[e >> 2] >> 2] | 0) - 1 << 2) >> 2] = c[f >> 2];
 i = d;
 return;
}

function Xh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 4112 | 0;
 e = g;
 d = g + 8 | 0;
 if (!a) {
  b = 4096;
  a = d;
  f = 4;
 } else if (!b) {
  c[(Hi() | 0) >> 2] = 22;
  a = 0;
 } else f = 4;
 if ((f | 0) == 4) {
  c[e >> 2] = a;
  c[e + 4 >> 2] = b;
  if ((rj(Va(183, e | 0) | 0) | 0) < 0) a = 0; else if ((a | 0) == (d | 0)) a = Di(d) | 0;
 }
 i = g;
 return a | 0;
}

function ig(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 4 | 0;
 f = g;
 c[e >> 2] = d;
 c[f >> 2] = 0;
 while (1) {
  d = c[f >> 2] | 0;
  if (!(a[c[e >> 2] >> 0] | 0)) break;
  h = d + (c[f >> 2] | 0) | 0;
  d = c[e >> 2] | 0;
  c[e >> 2] = d + 1;
  c[f >> 2] = ((h + (a[d >> 0] | 0) | 0) >>> 0) % ((c[b + 4 >> 2] | 0) >>> 0) | 0;
 }
 i = g;
 return d | 0;
}

function hg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 4 | 0;
 f = g;
 c[e >> 2] = d;
 c[f >> 2] = 0;
 while (1) {
  d = c[f >> 2] | 0;
  if (!(a[c[e >> 2] >> 0] | 0)) break;
  h = d + (c[f >> 2] | 0) | 0;
  d = c[e >> 2] | 0;
  c[e >> 2] = d + 1;
  c[f >> 2] = ((h + (a[d >> 0] | 0) | 0) >>> 0) % ((c[b + 4 >> 2] | 0) >>> 0) | 0;
 }
 i = g;
 return d | 0;
}

function ih(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 f = g;
 d = g + 8 | 0;
 e = g + 4 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 if (!(c[d >> 2] | 0)) za(28985, 28922, 43, 28987);
 if ((Rf(c[d >> 2] | 0) | 0) == -1) {
  g = c[1840] | 0;
  c[f >> 2] = c[(c[736] | 0) + 104 >> 2];
  $i(g, 28995, f) | 0;
  Li(c[e >> 2] | 0);
  _a(1);
 } else {
  i = g;
  return;
 }
}

function fc(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 b = i;
 i = i + 16 | 0;
 d = b + 8 | 0;
 e = b;
 f = b + 12 | 0;
 c[f >> 2] = a;
 Ab(c[(c[167] | 0) + (c[f >> 2] << 2) >> 2] | 0);
 Qi(10373, c[11] | 0) | 0;
 Qi(10373, c[12] | 0) | 0;
 ac(c[f >> 2] | 0);
 a = c[11] | 0;
 c[e >> 2] = 10394;
 $i(a, 16602, e) | 0;
 a = c[12] | 0;
 c[d >> 2] = 10394;
 $i(a, 16602, d) | 0;
 Yb();
 i = b;
 return;
}

function wi(b, c, d) {
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0, f = 0;
 a : do if (!d) d = 0; else {
  f = d;
  e = b;
  while (1) {
   b = a[e >> 0] | 0;
   d = a[c >> 0] | 0;
   if (b << 24 >> 24 != d << 24 >> 24) break;
   f = f + -1 | 0;
   if (!f) {
    d = 0;
    break a;
   } else {
    e = e + 1 | 0;
    c = c + 1 | 0;
   }
  }
  d = (b & 255) - (d & 255) | 0;
 } while (0);
 return d | 0;
}

function wb() {
 var a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 24 | 0;
 d = a + 16 | 0;
 e = a + 8 | 0;
 f = a;
 g = c[11] | 0;
 c[f >> 2] = 9422;
 $i(g, 16602, f) | 0;
 f = c[12] | 0;
 c[e >> 2] = 9422;
 $i(f, 16602, e) | 0;
 e = c[11] | 0;
 c[d >> 2] = 9443;
 $i(e, 16602, d) | 0;
 d = c[12] | 0;
 c[b >> 2] = 9443;
 $i(d, 16602, b) | 0;
 ub();
 i = a;
 return;
}

function Fd() {
 var b = 0, e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 32 | 0;
 g = h + 8 | 0;
 f = h;
 b = h + 12 | 0;
 e = h + 16 | 0;
 Dd(b, e);
 if ((d[e >> 0] | 0 | 0) == 4) {
  e = c[11] | 0;
  c[f >> 2] = 13109;
  $i(e, 16602, f) | 0;
  f = c[12] | 0;
  c[g >> 2] = 13109;
  $i(f, 16602, g) | 0;
  i = h;
  return;
 } else {
  Cc(c[b >> 2] | 0, a[e >> 0] | 0);
  i = h;
  return;
 }
}

function Eh(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 e = g + 4 | 0;
 f = g;
 c[e >> 2] = b;
 c[f >> 2] = d;
 if ((c[(c[e >> 2] | 0) + 8 >> 2] | 0) >>> 0 > (c[f >> 2] | 0) >>> 0) {
  a[(c[c[e >> 2] >> 2] | 0) + (c[f >> 2] | 0) >> 0] = 0;
  c[(c[e >> 2] | 0) + 8 >> 2] = (c[f >> 2] | 0) + 1;
  i = g;
  return;
 } else za(29401, 29341, 116, 29422);
}

function yd() {
 var a = 0;
 while (1) {
  if ((c[364] | 0) <= 1) {
   a = 9;
   break;
  }
  if ((c[365] | 0) >= (c[366] | 0)) {
   a = 9;
   break;
  }
  if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 125) c[364] = (c[364] | 0) - 1; else if ((d[(c[64] | 0) + (c[365] | 0) >> 0] | 0 | 0) == 123) c[364] = (c[364] | 0) + 1;
  c[365] = (c[365] | 0) + 1;
 }
 if ((a | 0) == 9) return;
}

function Dh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 8 | 0;
 g = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[g >> 2] = b;
 c[e >> 2] = si(c[g >> 2] | 0) | 0;
 Fh(c[f >> 2] | 0, c[e >> 2] | 0);
 pi(c[c[f >> 2] >> 2] | 0, c[g >> 2] | 0) | 0;
 b = (c[f >> 2] | 0) + 8 | 0;
 c[b >> 2] = (c[b >> 2] | 0) + (c[e >> 2] | 0);
 i = d;
 return;
}

function Xe(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 f = g;
 d = g + 12 | 0;
 e = g + 8 | 0;
 c[d >> 2] = a;
 c[e >> 2] = b;
 if (!(c[727] | 0)) {
  i = g;
  return;
 }
 if (!(c[728] | 0)) Ye();
 a = c[728] | 0;
 b = c[e >> 2] | 0;
 c[f >> 2] = c[d >> 2];
 c[f + 4 >> 2] = b;
 $i(a, 16046, f) | 0;
 ij(c[728] | 0) | 0;
 i = g;
 return;
}

function Ih(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 f = d + 8 | 0;
 e = d + 4 | 0;
 c[f >> 2] = a;
 c[e >> 2] = Qh(c[f >> 2] | 0) | 0;
 if (c[e >> 2] | 0) {
  f = c[1840] | 0;
  c[b >> 2] = c[(c[736] | 0) + 104 >> 2];
  $i(f, 29435, b) | 0;
  Qi(29447, c[1840] | 0) | 0;
  Qi(29463, c[1840] | 0) | 0;
  _a(1);
 } else {
  i = d;
  return;
 }
}

function tc(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Qi(10693, c[11] | 0) | 0;
 Qi(10693, c[12] | 0) | 0;
 Ab(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0);
 Vi(34, c[11] | 0) | 0;
 Vi(10, c[11] | 0) | 0;
 Vi(34, c[12] | 0) | 0;
 Vi(10, c[12] | 0) | 0;
 Qi(10703, c[11] | 0) | 0;
 Qi(10703, c[12] | 0) | 0;
 Ab(c[d >> 2] | 0);
 i = b;
 return;
}

function Ci(b, c) {
 b = b | 0;
 c = c | 0;
 var d = 0, e = 0;
 e = a[b >> 0] | 0;
 d = a[c >> 0] | 0;
 if (e << 24 >> 24 == 0 ? 1 : e << 24 >> 24 != d << 24 >> 24) c = e; else {
  do {
   b = b + 1 | 0;
   c = c + 1 | 0;
   e = a[b >> 0] | 0;
   d = a[c >> 0] | 0;
  } while (!(e << 24 >> 24 == 0 ? 1 : e << 24 >> 24 != d << 24 >> 24));
  c = e;
 }
 return (c & 255) - (d & 255) | 0;
}

function ae() {
 Dd(1468, 9384);
 if (!(c[174] | 0)) {
  yc();
  return;
 }
 if ((d[9384] | 0 | 0) != 1) if ((d[9384] | 0 | 0) != 3) {
  if ((d[9384] | 0 | 0) != 4) {
   Bc(c[367] | 0, a[9384] | 0);
   Qi(13416, c[11] | 0) | 0;
   Qi(13416, c[12] | 0) | 0;
   wc();
  }
  Cd(0, 0);
  return;
 }
 if ((d[9384] | 0 | 0) == 3) {
  Cd(1, 0);
  return;
 } else {
  Cd(0, 0);
  return;
 }
}

function Vc(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 d = i;
 i = i + 16 | 0;
 e = d + 8 | 0;
 g = d + 4 | 0;
 f = d;
 c[e >> 2] = a;
 c[g >> 2] = b;
 c[f >> 2] = c[(c[124] | 0) + (c[g >> 2] << 2) >> 2];
 c[(c[124] | 0) + (c[g >> 2] << 2) >> 2] = c[(c[124] | 0) + (c[e >> 2] << 2) >> 2];
 c[(c[124] | 0) + (c[e >> 2] << 2) >> 2] = c[f >> 2];
 i = d;
 return;
}

function fh(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0;
 f = i;
 i = i + 16 | 0;
 g = f + 8 | 0;
 d = f + 4 | 0;
 e = f;
 c[g >> 2] = b;
 c[d >> 2] = c[g >> 2];
 c[e >> 2] = c[d >> 2];
 while (1) {
  if (!(a[c[e >> 2] >> 0] | 0)) break;
  if ((a[c[e >> 2] >> 0] | 0) == 47) c[d >> 2] = (c[e >> 2] | 0) + 1;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 i = f;
 return c[d >> 2] | 0;
}

function fj(b) {
 b = b | 0;
 var c = 0, d = 0, e = 0;
 d = (ui(b, 43) | 0) == 0;
 c = a[b >> 0] | 0;
 d = d ? c << 24 >> 24 != 114 & 1 : 2;
 e = (ui(b, 120) | 0) == 0;
 d = e ? d : d | 128;
 b = (ui(b, 101) | 0) == 0;
 b = b ? d : d | 524288;
 b = c << 24 >> 24 == 114 ? b : b | 64;
 b = c << 24 >> 24 == 119 ? b | 512 : b;
 return (c << 24 >> 24 == 97 ? b | 1024 : b) | 0;
}

function Mi(b) {
 b = b | 0;
 var d = 0, e = 0;
 d = b + 74 | 0;
 e = a[d >> 0] | 0;
 a[d >> 0] = e + 255 | e;
 d = c[b >> 2] | 0;
 if (!(d & 8)) {
  c[b + 8 >> 2] = 0;
  c[b + 4 >> 2] = 0;
  d = c[b + 44 >> 2] | 0;
  c[b + 28 >> 2] = d;
  c[b + 20 >> 2] = d;
  c[b + 16 >> 2] = d + (c[b + 48 >> 2] | 0);
  d = 0;
 } else {
  c[b >> 2] = d | 32;
  d = -1;
 }
 return d | 0;
}

function Gg(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 h = i;
 i = i + 16 | 0;
 e = h + 8 | 0;
 f = h + 4 | 0;
 g = h;
 c[e >> 2] = b;
 c[f >> 2] = d;
 c[g >> 2] = $h(c[e >> 2] | 0, c[f >> 2] | 0, 2048) | 0;
 if ((c[g >> 2] | 0) < 0) {
  Li(c[e >> 2] | 0);
  _a(1);
 } else {
  a[(c[f >> 2] | 0) + (c[g >> 2] | 0) >> 0] = 0;
  i = h;
  return;
 }
}

function Si(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 f = i;
 i = i + 32 | 0;
 g = f;
 e = f + 20 | 0;
 c[g >> 2] = c[a + 60 >> 2];
 c[g + 4 >> 2] = 0;
 c[g + 8 >> 2] = b;
 c[g + 12 >> 2] = e;
 c[g + 16 >> 2] = d;
 if ((rj(Za(140, g | 0) | 0) | 0) < 0) {
  c[e >> 2] = -1;
  a = -1;
 } else a = c[e >> 2] | 0;
 i = f;
 return a | 0;
}

function oc() {
 var a = 0, b = 0, d = 0, e = 0, f = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 d = a;
 e = c[11] | 0;
 f = c[14] | 0;
 c[d >> 2] = 10535;
 c[d + 4 >> 2] = f;
 c[d + 8 >> 2] = 10560;
 $i(e, 9764, d) | 0;
 d = c[12] | 0;
 e = c[14] | 0;
 c[b >> 2] = 10535;
 c[b + 4 >> 2] = e;
 c[b + 8 >> 2] = 10560;
 $i(d, 9764, b) | 0;
 hc();
 i = a;
 return;
}

function kh(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 e = f;
 b = f + 8 | 0;
 d = f + 4 | 0;
 c[b >> 2] = a;
 c[d >> 2] = Bj((c[b >> 2] | 0) != 0 ? c[b >> 2] | 0 : 1) | 0;
 if (!(c[d >> 2] | 0)) {
  f = c[1840] | 0;
  c[e >> 2] = c[b >> 2];
  $i(f, 29007, e) | 0;
  _a(1);
 } else {
  i = f;
  return c[d >> 2] | 0;
 }
 return 0;
}

function gc() {
 var a = 0, b = 0, d = 0, e = 0, f = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 d = a;
 e = c[11] | 0;
 f = c[168] | 0;
 c[d >> 2] = 10016;
 c[d + 4 >> 2] = f;
 c[d + 8 >> 2] = 9781;
 $i(e, 9764, d) | 0;
 d = c[12] | 0;
 e = c[168] | 0;
 c[b >> 2] = 10016;
 c[b + 4 >> 2] = e;
 c[b + 8 >> 2] = 9781;
 $i(d, 9764, b) | 0;
 Pb();
 i = a;
 return;
}

function Xb() {
 var a = 0, b = 0, d = 0, e = 0, f = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 d = a;
 e = c[11] | 0;
 f = c[125] | 0;
 c[d >> 2] = 10016;
 c[d + 4 >> 2] = f;
 c[d + 8 >> 2] = 9781;
 $i(e, 9764, d) | 0;
 d = c[12] | 0;
 e = c[125] | 0;
 c[b >> 2] = 10016;
 c[b + 4 >> 2] = e;
 c[b + 8 >> 2] = 9781;
 $i(d, 9764, b) | 0;
 Rb();
 i = a;
 return;
}

function mc() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8930] | 0;
 c[e >> 2] = 10496;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 34;
 $i(f, 9872, e) | 0;
 e = c[12] | 0;
 f = d[8930] | 0;
 c[b >> 2] = 10496;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 34;
 $i(e, 9872, b) | 0;
 hc();
 i = a;
 return;
}

function wh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0, g = 0, h = 0;
 f = i;
 i = i + 16 | 0;
 h = f + 12 | 0;
 d = f + 8 | 0;
 e = f + 4 | 0;
 g = f;
 c[h >> 2] = a;
 c[d >> 2] = b;
 c[g >> 2] = xh(c[h >> 2] | 0) | 0;
 b = c[h >> 2] | 0;
 if (!(c[g >> 2] | 0)) b = Ef(b, 34049, c[d >> 2] | 0) | 0;
 c[e >> 2] = b;
 i = f;
 return c[e >> 2] | 0;
}

function Ph(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 e = i;
 i = i + 32 | 0;
 f = e;
 g = e + 16 | 0;
 c[g >> 2] = d;
 h = (c[g >> 2] | 0) + (4 - 1) & ~(4 - 1);
 d = c[h >> 2] | 0;
 c[g >> 2] = h + 4;
 c[f >> 2] = a;
 c[f + 4 >> 2] = b | 32768;
 c[f + 8 >> 2] = d;
 d = rj(Ua(5, f | 0) | 0) | 0;
 i = e;
 return d | 0;
}

function ec() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8994] | 0;
 c[e >> 2] = 34;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 10347;
 $i(f, 10265, e) | 0;
 e = c[12] | 0;
 f = d[8994] | 0;
 c[b >> 2] = 34;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 10347;
 $i(e, 10265, b) | 0;
 i = a;
 return;
}

function dc() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8992] | 0;
 c[e >> 2] = 34;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 10347;
 $i(f, 10265, e) | 0;
 e = c[12] | 0;
 f = d[8992] | 0;
 c[b >> 2] = 34;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 10347;
 $i(e, 10265, b) | 0;
 i = a;
 return;
}

function Nb() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8994] | 0;
 c[e >> 2] = 9884;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 34;
 $i(f, 9872, e) | 0;
 e = c[12] | 0;
 f = d[8994] | 0;
 c[b >> 2] = 9884;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 34;
 $i(e, 9872, b) | 0;
 i = a;
 return;
}

function Mb() {
 var a = 0, b = 0, e = 0, f = 0, g = 0;
 a = i;
 i = i + 32 | 0;
 b = a + 16 | 0;
 e = a;
 f = c[11] | 0;
 g = d[8994] | 0;
 c[e >> 2] = 9879;
 c[e + 4 >> 2] = g;
 c[e + 8 >> 2] = 34;
 $i(f, 9872, e) | 0;
 e = c[12] | 0;
 f = d[8994] | 0;
 c[b >> 2] = 9879;
 c[b + 4 >> 2] = f;
 c[b + 8 >> 2] = 34;
 $i(e, 9872, b) | 0;
 i = a;
 return;
}

function Bb() {
 var a = 0, b = 0, d = 0, e = 0, f = 0;
 a = i;
 i = i + 16 | 0;
 b = a;
 d = c[11] | 0;
 f = (c[65] | 0) + 65e3 | 0;
 e = c[65] | 0;
 c[b >> 2] = 9619;
 c[b + 4 >> 2] = 1;
 c[b + 8 >> 2] = f;
 c[b + 12 >> 2] = e;
 $i(d, 9481, b) | 0;
 c[64] = mh(c[64] | 0, (c[65] | 0) + 65e3 + 1 | 0) | 0;
 c[65] = (c[65] | 0) + 65e3;
 i = a;
 return;
}

function ef(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 d = f + 4 | 0;
 e = f;
 c[d >> 2] = a;
 c[e >> 2] = b;
 if (!(c[(c[d >> 2] | 0) + 132 + ((c[e >> 2] | 0) * 68 | 0) + 4 >> 2] | 0)) ff(c[d >> 2] | 0, c[e >> 2] | 0) | 0;
 i = f;
 return c[(c[d >> 2] | 0) + 132 + ((c[e >> 2] | 0) * 68 | 0) + 4 >> 2] | 0;
}

function Cb(a) {
 a = a | 0;
 var b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f + 4 | 0;
 e = f;
 c[b >> 2] = a;
 c[e >> 2] = c[66];
 while (1) {
  if ((c[e >> 2] | 0) >= (c[67] | 0)) break;
  Vi(d[8869 + (d[(c[15] | 0) + (c[e >> 2] | 0) >> 0] | 0) >> 0] | 0, c[b >> 2] | 0) | 0;
  c[e >> 2] = (c[e >> 2] | 0) + 1;
 }
 i = f;
 return;
}

function Bh(b, d) {
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 g = e + 4 | 0;
 c[f >> 2] = b;
 a[g >> 0] = d;
 Fh(c[f >> 2] | 0, 1);
 a[(c[c[f >> 2] >> 2] | 0) + (c[(c[f >> 2] | 0) + 8 >> 2] | 0) >> 0] = a[g >> 0] | 0;
 b = (c[f >> 2] | 0) + 8 | 0;
 c[b >> 2] = (c[b >> 2] | 0) + 1;
 i = e;
 return;
}

function uc() {
 var a = 0, b = 0, d = 0, e = 0;
 a = i;
 i = i + 16 | 0;
 b = a + 8 | 0;
 d = a;
 Qi(10721, c[11] | 0) | 0;
 Qi(10721, c[12] | 0) | 0;
 tc(c[(c[171] | 0) + (c[173] << 2) >> 2] | 0);
 e = c[11] | 0;
 c[d >> 2] = 10744;
 $i(e, 16602, d) | 0;
 d = c[12] | 0;
 c[b >> 2] = 10744;
 $i(d, 16602, b) | 0;
 tb();
 i = a;
 return;
}

function Jd() {
 while (1) {
  if (((c[259] | 0) + (c[355] | 0) | 0) <= (c[65] | 0)) break;
  Bb();
 }
 c[273] = 0;
 while (1) {
  if ((c[273] | 0) >= (c[355] | 0)) break;
  a[(c[64] | 0) + (c[259] | 0) >> 0] = a[(c[17] | 0) + (c[273] | 0) >> 0] | 0;
  c[259] = (c[259] | 0) + 1;
  c[273] = (c[273] | 0) + 1;
 }
 Cd(Lc() | 0, 1);
 return;
}

function xd() {
 var a = 0;
 c[362] = (c[361] | 0) - 1;
 while (1) {
  if ((c[362] | 0) <= (c[363] | 0)) {
   a = 5;
   break;
  }
  c[357] = c[(c[19] | 0) + ((c[362] | 0) - 1 << 2) >> 2];
  c[358] = c[(c[19] | 0) + (c[362] << 2) >> 2];
  if (wd() | 0) {
   a = 5;
   break;
  }
  c[362] = (c[362] | 0) - 1;
 }
 if ((a | 0) == 5) return;
}

function Li(b) {
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = c[1840] | 0;
 f = Gi(c[(Hi() | 0) >> 2] | 0) | 0;
 if ((c[d + 76 >> 2] | 0) > -1) e = cj(d) | 0; else e = 0;
 if (b) if (a[b >> 0] | 0) {
  Ji(b, si(b) | 0, 1, d) | 0;
  Ki(58, d) | 0;
  Ki(32, d) | 0;
 }
 Ji(f, si(f) | 0, 1, d) | 0;
 Ki(10, d) | 0;
 if (e) dj(d);
 return;
}

function _i(b, d, e) {
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0;
 g = i;
 i = i + 80 | 0;
 f = g;
 c[b + 36 >> 2] = 5;
 if (!(c[b >> 2] & 64)) {
  c[f >> 2] = c[b + 60 >> 2];
  c[f + 4 >> 2] = 21505;
  c[f + 8 >> 2] = g + 12;
  if (Na(54, f | 0) | 0) a[b + 75 >> 0] = -1;
 }
 f = Ri(b, d, e) | 0;
 i = g;
 return f | 0;
}

function rg(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0, j = 0;
 f = i;
 i = i + 16 | 0;
 j = f + 12 | 0;
 h = f + 8 | 0;
 g = f + 4 | 0;
 e = f;
 c[j >> 2] = a;
 c[h >> 2] = b;
 c[g >> 2] = d;
 c[e >> 2] = vg(c[j >> 2] | 0, c[h >> 2] | 0, c[g >> 2] | 0, 1, 1) | 0;
 i = f;
 return c[e >> 2] | 0;
}

function df(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0, h = 0, j = 0, k = 0;
 f = i;
 i = i + 32 | 0;
 k = f + 24 | 0;
 j = f + 20 | 0;
 h = f + 16 | 0;
 g = f;
 c[k >> 2] = a;
 c[j >> 2] = b;
 c[h >> 2] = d;
 c[g >> 2] = e;
 of(c[k >> 2] | 0, c[j >> 2] | 0, c[h >> 2] | 0, g);
 i = f;
 return;
}

function Rh(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 d = e + 8 | 0;
 b = Ph(a, 589824, e) | 0;
 do if ((b | 0) < 0) a = 0; else {
  a = Dj(1, 2072) | 0;
  if (!a) {
   c[d >> 2] = b;
   Ta(6, d | 0) | 0;
   a = 0;
   break;
  } else {
   c[a >> 2] = b;
   break;
  }
 } while (0);
 i = e;
 return a | 0;
}

function Gb() {
 var a = 0, b = 0, e = 0;
 b = i;
 i = i + 16 | 0;
 a = b;
 Qi(9710, c[12] | 0) | 0;
 c[68] = 1;
 while (1) {
  if ((c[68] | 0) > (c[69] | 0)) break;
  Vi(d[(c[70] | 0) + (c[68] | 0) >> 0] | 0, c[12] | 0) | 0;
  c[68] = (c[68] | 0) + 1;
 }
 e = c[12] | 0;
 c[a >> 2] = 9722;
 $i(e, 16602, a) | 0;
 i = b;
 return;
}

function Re(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 e = i;
 i = i + 16 | 0;
 d = e;
 b = e + 4 | 0;
 c[b >> 2] = a;
 if ((c[b >> 2] | 0) >= (c[720] | 0)) {
  e = c[1840] | 0;
  c[d >> 2] = c[c[721] >> 2];
  $i(e, 15993, d) | 0;
  $e(1);
 } else {
  i = e;
  return c[(c[721] | 0) + (c[b >> 2] << 2) >> 2] | 0;
 }
 return 0;
}

function uh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 g = i;
 i = i + 16 | 0;
 h = g + 8 | 0;
 e = g + 4 | 0;
 f = g;
 c[h >> 2] = a;
 c[e >> 2] = b;
 c[f >> 2] = d;
 if (!(Jh(c[h >> 2] | 0, c[f >> 2] | 0) | 0)) {
  i = g;
  return;
 }
 vh(c[e >> 2] | 0, c[f >> 2] | 0);
 i = g;
 return;
}

function Qj(b, c, d) {
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0;
 if ((c | 0) < (b | 0) & (b | 0) < (c + d | 0)) {
  e = b;
  c = c + d | 0;
  b = b + d | 0;
  while ((d | 0) > 0) {
   b = b - 1 | 0;
   c = c - 1 | 0;
   d = d - 1 | 0;
   a[b >> 0] = a[c >> 0] | 0;
  }
  b = e;
 } else Pj(b, c, d) | 0;
 return b | 0;
}

function Tj(a, b) {
 a = a | 0;
 b = b | 0;
 var c = 0, d = 0, e = 0, f = 0;
 f = a & 65535;
 e = b & 65535;
 c = _(e, f) | 0;
 d = a >>> 16;
 a = (c >>> 16) + (_(e, d) | 0) | 0;
 e = b >>> 16;
 b = _(e, f) | 0;
 return (C = (a >>> 16) + (_(e, d) | 0) + (((a & 65535) + b | 0) >>> 16) | 0, a + b << 16 | c & 65535 | 0) | 0;
}

function Yb() {
 var a = 0;
 Vi(45, c[11] | 0) | 0;
 Vi(45, c[12] | 0) | 0;
 Xb();
 Eb();
 while (1) {
  if (!(c[21] | 0)) {
   a = 6;
   break;
  }
  if (!(yb(c[126] | 0) | 0)) {
   a = 4;
   break;
  }
  c[125] = (c[125] | 0) + 1;
 }
 if ((a | 0) == 4) xa(508, 1); else if ((a | 0) == 6) {
  c[67] = c[21];
  return;
 }
}

function Jh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 e = i;
 i = i + 96 | 0;
 f = e + 76 | 0;
 d = e;
 c[e + 80 >> 2] = a;
 c[f >> 2] = b;
 if (Uh(c[f >> 2] | 0, d) | 0) {
  f = 0;
  f = f & 1;
  i = e;
  return f | 0;
 }
 f = (c[d + 12 >> 2] & 61440 | 0) == 16384;
 f = f & 1;
 i = e;
 return f | 0;
}

function Od() {
 var b = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(0, 0);
  return;
 }
 b = c[387] | 0;
 if (d[9385] | 0) {
  Ed(b, a[9385] | 0, 0);
  Cd(0, 0);
  return;
 }
 if ((b | 0) < (c[367] | 0)) {
  Cd(1, 0);
  return;
 } else {
  Cd(0, 0);
  return;
 }
}

function Nd() {
 var b = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(0, 0);
  return;
 }
 b = c[387] | 0;
 if (d[9385] | 0) {
  Ed(b, a[9385] | 0, 0);
  Cd(0, 0);
  return;
 }
 if ((b | 0) > (c[367] | 0)) {
  Cd(1, 0);
  return;
 } else {
  Cd(0, 0);
  return;
 }
}

function be() {
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  Cd(0, 0);
  return;
 }
 c[355] = 0;
 Kd(c[367] | 0);
 c[273] = 0;
 c[401] = 0;
 while (1) {
  if ((c[273] | 0) >= (c[355] | 0)) break;
  vd(c[367] | 0);
  c[401] = (c[401] | 0) + 1;
 }
 Cd(c[401] | 0, 0);
 return;
}

function Ji(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0;
 f = _(d, b) | 0;
 if ((c[e + 76 >> 2] | 0) > -1) {
  g = (cj(e) | 0) == 0;
  a = Ii(a, f, e) | 0;
  if (!g) dj(e);
 } else a = Ii(a, f, e) | 0;
 if ((a | 0) != (f | 0)) d = (a >>> 0) / (b >>> 0) | 0;
 return d | 0;
}

function Dj(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0;
 if (!a) d = 0; else {
  d = _(b, a) | 0;
  if ((b | a) >>> 0 > 65535) d = ((d >>> 0) / (a >>> 0) | 0 | 0) == (b | 0) ? d : -1;
 }
 b = Bj(d) | 0;
 if (!b) return b | 0;
 if (!(c[b + -4 >> 2] & 3)) return b | 0;
 Jj(b | 0, 0, d | 0) | 0;
 return b | 0;
}

function Ah(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 if (c[c[b >> 2] >> 2] | 0) {
  Cj(c[c[b >> 2] >> 2] | 0);
  c[c[b >> 2] >> 2] = 0;
  c[(c[b >> 2] | 0) + 4 >> 2] = 0;
  c[(c[b >> 2] | 0) + 8 >> 2] = 0;
  i = d;
  return;
 } else za(29318, 29341, 62, 29393);
}

function wf(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 e = i;
 i = i + 16 | 0;
 h = e + 8 | 0;
 g = e + 4 | 0;
 f = e;
 c[h >> 2] = a;
 c[g >> 2] = b;
 c[f >> 2] = d;
 d = vf(c[h >> 2] | 0, c[g >> 2] | 0, 19807, 19819, 1, c[f >> 2] | 0) | 0;
 i = e;
 return d | 0;
}

function Sj(b) {
 b = b | 0;
 var c = 0;
 c = a[m + (b & 255) >> 0] | 0;
 if ((c | 0) < 8) return c | 0;
 c = a[m + (b >> 8 & 255) >> 0] | 0;
 if ((c | 0) < 8) return c + 8 | 0;
 c = a[m + (b >> 16 & 255) >> 0] | 0;
 if ((c | 0) < 8) return c + 16 | 0;
 return (a[m + (b >>> 24) >> 0] | 0) + 24 | 0;
}

function jf(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0, g = 0, h = 0;
 e = i;
 i = i + 16 | 0;
 h = e + 8 | 0;
 g = e + 4 | 0;
 f = e;
 c[h >> 2] = a;
 c[g >> 2] = b;
 c[f >> 2] = d;
 a = gf(c[736] | 0, c[h >> 2] | 0, c[g >> 2] | 0, c[f >> 2] | 0) | 0;
 i = e;
 return a | 0;
}

function je() {
 if (!(c[174] | 0)) {
  yc();
  return;
 }
 if ((c[(c[122] | 0) + (c[172] << 2) >> 2] | 0) != (c[408] | 0)) if (c[(c[122] | 0) + (c[172] << 2) >> 2] | 0) {
  Cd(c[(c[167] | 0) + (c[(c[122] | 0) + (c[172] << 2) >> 2] << 2) >> 2] | 0, 1);
  return;
 }
 Cd(c[323] | 0, 1);
 return;
}

function Fc() {
 var a = 0, b = 0, d = 0, e = 0;
 a = i;
 i = i + 16 | 0;
 b = a + 8 | 0;
 d = a;
 Qi(11060, c[11] | 0) | 0;
 Qi(11060, c[12] | 0) | 0;
 xc();
 e = c[11] | 0;
 c[d >> 2] = 11074;
 $i(e, 16602, d) | 0;
 d = c[12] | 0;
 c[b >> 2] = 11074;
 $i(d, 16602, b) | 0;
 i = a;
 return;
}

function vc(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Qi(10767, c[11] | 0) | 0;
 Qi(10767, c[12] | 0) | 0;
 Ab(c[d >> 2] | 0);
 Vi(34, c[11] | 0) | 0;
 Vi(10, c[11] | 0) | 0;
 Vi(34, c[12] | 0) | 0;
 Vi(10, c[12] | 0) | 0;
 sb();
 i = b;
 return;
}

function jh() {
 var a = 0, b = 0, d = 0;
 d = i;
 i = i + 4112 | 0;
 b = d;
 a = d + 4 | 0;
 if (!(Xh(a, 4097) | 0)) {
  d = c[1840] | 0;
  c[b >> 2] = c[(c[736] | 0) + 104 >> 2];
  $i(d, 28995, b) | 0;
  Li(29e3);
  _a(1);
 } else {
  b = nh(a) | 0;
  i = d;
  return b | 0;
 }
 return 0;
}

function hj(a) {
 a = a | 0;
 var b = 0, e = 0, f = 0;
 f = i;
 i = i + 16 | 0;
 b = f;
 if (!(c[a + 8 >> 2] | 0)) if (!(Ni(a) | 0)) e = 3; else b = -1; else e = 3;
 if ((e | 0) == 3) if ((cb[c[a + 32 >> 2] & 7](a, b, 1) | 0) == 1) b = d[b >> 0] | 0; else b = -1;
 i = f;
 return b | 0;
}

function $e(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d + 4 | 0;
 c[b >> 2] = a;
 do if (!(c[b >> 2] | 0)) c[d >> 2] = 0; else if ((c[b >> 2] | 0) == 1) {
  c[d >> 2] = 1;
  break;
 } else {
  c[d >> 2] = c[b >> 2];
  break;
 } while (0);
 _a(c[d >> 2] | 0);
}

function Qd() {
 var b = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(0, 0);
  return;
 }
 b = c[387] | 0;
 if (d[9385] | 0) {
  Ed(b, a[9385] | 0, 0);
  Cd(0, 0);
  return;
 } else {
  Cd(b - (c[367] | 0) | 0, 0);
  return;
 }
}

function Pd() {
 var b = 0;
 Dd(1468, 9384);
 Dd(1548, 9385);
 if (d[9384] | 0) {
  Ed(c[367] | 0, a[9384] | 0, 0);
  Cd(0, 0);
  return;
 }
 b = c[387] | 0;
 if (d[9385] | 0) {
  Ed(b, a[9385] | 0, 0);
  Cd(0, 0);
  return;
 } else {
  Cd(b + (c[367] | 0) | 0, 0);
  return;
 }
}

function ob(b) {
 b = b | 0;
 a[k >> 0] = a[b >> 0];
 a[k + 1 >> 0] = a[b + 1 >> 0];
 a[k + 2 >> 0] = a[b + 2 >> 0];
 a[k + 3 >> 0] = a[b + 3 >> 0];
 a[k + 4 >> 0] = a[b + 4 >> 0];
 a[k + 5 >> 0] = a[b + 5 >> 0];
 a[k + 6 >> 0] = a[b + 6 >> 0];
 a[k + 7 >> 0] = a[b + 7 >> 0];
}

function Aj(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = a + 20 | 0;
 f = c[e >> 2] | 0;
 a = (c[a + 16 >> 2] | 0) - f | 0;
 a = a >>> 0 > d >>> 0 ? d : a;
 Pj(f | 0, b | 0, a | 0) | 0;
 c[e >> 2] = (c[e >> 2] | 0) + a;
 return d | 0;
}

function Hb() {
 Qi(9736, c[12] | 0) | 0;
 c[68] = 1;
 while (1) {
  if ((c[68] | 0) > (c[71] | 0)) break;
  Vi(d[(c[70] | 0) + (c[68] | 0) >> 0] | 0, c[12] | 0) | 0;
  c[68] = (c[68] | 0) + 1;
 }
 Vi(39, c[12] | 0) | 0;
 Vi(10, c[12] | 0) | 0;
 return;
}

function Oj(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 while ((f | 0) < (d | 0)) {
  e = c[b + (f << 3) >> 2] | 0;
  if (!e) break;
  if ((e | 0) == (a | 0)) return c[b + ((f << 3) + 4) >> 2] | 0;
  f = f + 1 | 0;
 }
 return 0;
}

function Pg(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 if (!(c[(c[b >> 2] | 0) + 4 >> 2] | 0)) {
  i = d;
  return;
 }
 Cj(c[(c[b >> 2] | 0) + 4 >> 2] | 0);
 c[(c[b >> 2] | 0) + 4 >> 2] = 0;
 i = d;
 return;
}

function Gc(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Qi(11112, c[11] | 0) | 0;
 Qi(11112, c[12] | 0) | 0;
 Ab(c[d >> 2] | 0);
 Qi(11123, c[11] | 0) | 0;
 Qi(11123, c[12] | 0) | 0;
 xc();
 i = b;
 return;
}

function yh(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d + 8 >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[d >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 c[a + 8 >> 2] = c[d + 8 >> 2];
 i = b;
 return;
}

function nh(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 b = i;
 i = i + 16 | 0;
 d = b + 4 | 0;
 e = b;
 c[d >> 2] = a;
 c[e >> 2] = kh((si(c[d >> 2] | 0) | 0) + 1 | 0) | 0;
 a = zi(c[e >> 2] | 0, c[d >> 2] | 0) | 0;
 i = b;
 return a | 0;
}

function Qe(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[d + 8 >> 2] = 0;
 c[f >> 2] = a;
 c[e >> 2] = b;
 c[720] = c[f >> 2];
 c[721] = c[e >> 2];
 Ne();
 i = d;
 return 0;
}

function kf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 a = vf(c[f >> 2] | 0, c[e >> 2] | 0, 19796, 21326, 0, 0) | 0;
 i = d;
 return a | 0;
}

function zf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 b = yf(c[736] | 0, c[f >> 2] | 0, c[e >> 2] | 0) | 0;
 i = d;
 return b | 0;
}

function wc() {
 if (c[174] | 0) {
  Qi(10813, c[11] | 0) | 0;
  Qi(10813, c[12] | 0) | 0;
  Ab(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0);
 }
 rb();
 Qi(10825, c[11] | 0) | 0;
 Qi(10825, c[12] | 0) | 0;
 Xb();
 tb();
 return;
}

function ke() {
 Dd(1468, 9384);
 if ((d[9384] | 0 | 0) != 1) {
  Ed(c[367] | 0, a[9384] | 0, 1);
  return;
 } else {
  Qi(13633, c[11] | 0) | 0;
  Qi(13633, c[12] | 0) | 0;
  Cc(c[367] | 0, a[9384] | 0);
  sb();
  return;
 }
}

function Fi(b, c, d) {
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0;
 e = c & 255;
 do {
  if (!d) {
   c = 0;
   break;
  }
  d = d + -1 | 0;
  c = b + d | 0;
 } while ((a[c >> 0] | 0) != e << 24 >> 24);
 return c | 0;
}

function $h(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 c[f >> 2] = a;
 c[f + 4 >> 2] = b;
 c[f + 8 >> 2] = d;
 a = rj(ma(85, f | 0) | 0) | 0;
 i = e;
 return a | 0;
}

function _h(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 c[f >> 2] = a;
 c[f + 4 >> 2] = b;
 c[f + 8 >> 2] = d;
 a = rj(Ra(3, f | 0) | 0) | 0;
 i = e;
 return a | 0;
}

function Zh(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 c[f >> 2] = a;
 c[f + 4 >> 2] = b;
 c[f + 8 >> 2] = d;
 a = rj(ua(4, f | 0) | 0) | 0;
 i = e;
 return a | 0;
}

function td(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 if (!(c[352] | 0)) {
  Gc(c[b >> 2] | 0);
  i = d;
  return;
 } else {
  c[352] = (c[352] | 0) - 1;
  i = d;
  return;
 }
}

function ng(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 b = og(c[f >> 2] | 0, c[e >> 2] | 0, 0) | 0;
 i = d;
 return b | 0;
}

function mg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 b = og(c[f >> 2] | 0, c[e >> 2] | 0, 1) | 0;
 i = d;
 return b | 0;
}

function lf(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 a = wf(c[f >> 2] | 0, c[e >> 2] | 0, 0) | 0;
 i = d;
 return a | 0;
}

function xc() {
 if (c[174] | 0) {
  Qi(10813, c[11] | 0) | 0;
  Qi(10813, c[12] | 0) | 0;
  Ab(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0);
 }
 rb();
 Qi(10842, c[11] | 0) | 0;
 Qi(10842, c[12] | 0) | 0;
 Zb();
 return;
}

function Zi(a) {
 a = a | 0;
 var b = 0, d = 0, e = 0;
 if (aj(a) | 0) {
  b = a + 76 | 0;
  d = a + 80 | 0;
  do {
   e = c[b >> 2] | 0;
   if (e) ya(b | 0, d | 0, e | 0, 1);
  } while ((aj(a) | 0) != 0);
 }
 return;
}

function Bg(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0, f = 0;
 d = i;
 i = i + 16 | 0;
 f = d + 4 | 0;
 e = d;
 c[f >> 2] = a;
 c[e >> 2] = b;
 Ag(c[736] | 0, c[f >> 2] | 0, c[e >> 2] | 0);
 i = d;
 return;
}

function Yj(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0;
 g = i;
 i = i + 16 | 0;
 f = g | 0;
 Zj(a, b, d, e, f) | 0;
 i = g;
 return (C = c[f + 4 >> 2] | 0, c[f >> 2] | 0) | 0;
}

function Yi(a) {
 a = a | 0;
 var b = 0, d = 0;
 if ((c[a + 76 >> 2] | 0) > -1) {
  d = (cj(a) | 0) == 0;
  b = (c[a >> 2] | 0) >>> 4 & 1;
  if (!d) dj(a);
 } else b = (c[a >> 2] | 0) >>> 4 & 1;
 return b | 0;
}

function nj(a) {
 a = a | 0;
 var b = 0, e = 0;
 b = a + 4 | 0;
 e = c[b >> 2] | 0;
 if (e >>> 0 < (c[a + 8 >> 2] | 0) >>> 0) {
  c[b >> 2] = e + 1;
  b = d[e >> 0] | 0;
 } else b = hj(a) | 0;
 return b | 0;
}

function Wj(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = a;
 f = c;
 c = Tj(e, f) | 0;
 a = C;
 return (C = (_(b, f) | 0) + (_(d, e) | 0) + a | a & 0, c | 0 | 0) | 0;
}

function Rj(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 if ((c | 0) < 32) {
  C = b >> c;
  return a >>> c | (b & (1 << c) - 1) << 32 - c;
 }
 C = (b | 0) < 0 ? -1 : 0;
 return b >> c - 32 | 0;
}

function $d() {
 var b = 0;
 Dd(1468, 9384);
 b = c[367] | 0;
 if (d[9384] | 0) {
  Ed(b, a[9384] | 0, 0);
  Cd(c[323] | 0, 1);
  return;
 } else {
  Sc(b, c[17] | 0, 0, 1420);
  Jd();
  return;
 }
}

function ce() {
 c[355] = 0;
 c[326] = 0;
 while (1) {
  if ((c[326] | 0) >= (c[407] | 0)) break;
  Kd(c[(c[347] | 0) + (c[326] << 2) >> 2] | 0);
  c[326] = (c[326] | 0) + 1;
 }
 Jd();
 return;
}

function sg(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 i = b;
 return;
}

function qj(a, b, d, e) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 e = e | 0;
 var f = 0, g = 0;
 f = i;
 i = i + 16 | 0;
 g = f;
 c[g >> 2] = e;
 e = Pi(a, b, d, g) | 0;
 i = f;
 return e | 0;
}

function jg(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 i = b;
 return;
}

function Xf(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 i = b;
 return;
}

function Rg(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 i = b;
 return;
}

function Kf(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = 0;
 c[d + 4 >> 2] = 0;
 c[a >> 2] = c[d >> 2];
 c[a + 4 >> 2] = c[d + 4 >> 2];
 i = b;
 return;
}

function ee() {
 while (1) {
  if (((c[259] | 0) + 1 | 0) <= (c[65] | 0)) break;
  Bb();
 }
 a[(c[64] | 0) + (c[259] | 0) >> 0] = 34;
 c[259] = (c[259] | 0) + 1;
 Cd(Lc() | 0, 1);
 return;
}

function Uh(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0;
 d = i;
 i = i + 16 | 0;
 e = d;
 c[e >> 2] = a;
 c[e + 4 >> 2] = b;
 a = rj(Ea(195, e | 0) | 0) | 0;
 i = d;
 return a | 0;
}

function Th(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0;
 d = i;
 i = i + 16 | 0;
 e = d;
 c[e >> 2] = a;
 c[e + 4 >> 2] = b;
 a = rj(Da(196, e | 0) | 0) | 0;
 i = d;
 return a | 0;
}

function bi(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0;
 d = i;
 i = i + 16 | 0;
 e = d;
 c[e >> 2] = a;
 c[e + 4 >> 2] = b;
 a = rj(Ma(33, e | 0) | 0) | 0;
 i = d;
 return a | 0;
}

function He() {
 if (!(c[697] | 0)) {
  Qi(15134, c[11] | 0) | 0;
  Qi(15134, c[12] | 0) | 0;
  Yb();
  return;
 }
 if ((c[179] | 0) <= 1) return;
 Xc(0, (c[179] | 0) - 1 | 0);
 return;
}

function af(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 d = d + 4 | 0;
 c[d >> 2] = a;
 a = c[1840] | 0;
 c[b >> 2] = c[d >> 2];
 $i(a, 16549, b) | 0;
 $e(1);
}

function Kj(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 if ((c | 0) < 32) {
  C = b << c | (a & (1 << c) - 1 << 32 - c) >>> 32 - c;
  return a << c;
 }
 C = a << c - 32;
 return 0;
}

function ud(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 if ((c[352] | 0) <= 0) {
  i = d;
  return;
 }
 Gc(c[b >> 2] | 0);
 i = d;
 return;
}

function ai(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = Ta(6, d | 0) | 0;
 a = rj((a | 0) == -4 ? -115 : a) | 0;
 i = b;
 return a | 0;
}

function Nj(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 if ((c | 0) < 32) {
  C = b >>> c;
  return a >>> c | (b & (1 << c) - 1) << 32 - c;
 }
 C = 0;
 return b >>> c - 32 | 0;
}

function We(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 if (c[b >> 2] | 0) if ((Ti(c[b >> 2] | 0) | 0) == -1) Li(16039);
 i = d;
 return;
}

function Ab(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 zb(c[12] | 0, c[d >> 2] | 0);
 zb(c[11] | 0, c[d >> 2] | 0);
 i = b;
 return;
}

function Hj() {}
function Ij(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 d = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0;
 return (C = d, a - c >>> 0 | 0) | 0;
}

function Xi(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 c[f >> 2] = d;
 d = Ui(a, b, f) | 0;
 i = e;
 return d | 0;
}

function $i(a, b, d) {
 a = a | 0;
 b = b | 0;
 d = d | 0;
 var e = 0, f = 0;
 e = i;
 i = i + 16 | 0;
 f = e;
 c[f >> 2] = d;
 d = pj(a, b, f) | 0;
 i = e;
 return d | 0;
}

function lj(a, b) {
 a = a | 0;
 b = b | 0;
 var d = 0, e = 0;
 d = i;
 i = i + 16 | 0;
 e = d;
 c[e >> 2] = b;
 b = pj(c[1838] | 0, a, e) | 0;
 i = d;
 return b | 0;
}

function Wi(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = c[a + 60 >> 2];
 a = rj(Ta(6, d | 0) | 0) | 0;
 i = b;
 return a | 0;
}

function nf(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = lf(c[736] | 0, c[d >> 2] | 0) | 0;
 i = b;
 return a | 0;
}

function mf(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = kf(c[736] | 0, c[d >> 2] | 0) | 0;
 i = b;
 return a | 0;
}

function me() {
 var b = 0;
 Dd(1468, 9384);
 b = c[367] | 0;
 if ((d[9384] | 0 | 0) != 1) {
  Ed(b, a[9384] | 0, 1);
  return;
 } else {
  Ld(b);
  return;
 }
}

function ah(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = $g(c[736] | 0, c[d >> 2] | 0) | 0;
 i = b;
 return a | 0;
}

function zd() {
 Qi(12912, c[11] | 0) | 0;
 Qi(12912, c[12] | 0) | 0;
 Ab(c[367] | 0);
 Qi(12932, c[11] | 0) | 0;
 Qi(12932, c[12] | 0) | 0;
 wc();
 return;
}

function Lj(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 c = a + c >>> 0;
 return (C = b + d + (c >>> 0 < a >>> 0 | 0) >>> 0, c | 0) | 0;
}

function Di(a) {
 a = a | 0;
 var b = 0, c = 0;
 c = (si(a) | 0) + 1 | 0;
 b = Bj(c) | 0;
 if (!b) b = 0; else Pj(b | 0, a | 0, c | 0) | 0;
 return b | 0;
}

function Yh(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = rj(Wa(41, d | 0) | 0) | 0;
 i = b;
 return a | 0;
}

function Vh(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 a = rj(qa(42, d | 0) | 0) | 0;
 i = b;
 return a | 0;
}

function nb(b) {
 b = b | 0;
 a[k >> 0] = a[b >> 0];
 a[k + 1 >> 0] = a[b + 1 >> 0];
 a[k + 2 >> 0] = a[b + 2 >> 0];
 a[k + 3 >> 0] = a[b + 3 >> 0];
}

function ue() {
 We(c[2664 + (c[72] << 2) >> 2] | 0);
 if (!(c[72] | 0)) {
  c[10] = 1;
  return;
 } else {
  c[72] = (c[72] | 0) - 1;
  return;
 }
}

function sb() {
 if ((d[8356] | 0 | 0) == 1) {
  c[13] = (c[13] | 0) + 1;
  return;
 }
 if (d[8356] | 0) return;
 a[8356] = 1;
 c[13] = 1;
 return;
}

function Te(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Xe(16032, c[d >> 2] | 0);
 i = b;
 return;
}

function Se(a) {
 a = a | 0;
 var b = 0, d = 0;
 b = i;
 i = i + 16 | 0;
 d = b;
 c[d >> 2] = a;
 Xe(16026, c[d >> 2] | 0);
 i = b;
 return;
}

function pc() {
 Qi(10572, c[11] | 0) | 0;
 Qi(10572, c[12] | 0) | 0;
 Db();
 Qi(10595, c[11] | 0) | 0;
 Qi(10595, c[12] | 0) | 0;
 return;
}

function oj(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = a + 68 | 0;
 b = (c[d >> 2] | 0) + -1 | 0;
 c[d >> 2] = b;
 if (!b) dj(a);
 return;
}

function Qb() {
 zb(c[11] | 0, c[(c[116] | 0) + (c[115] << 2) >> 2] | 0);
 zb(c[11] | 0, c[117] | 0);
 Vi(10, c[11] | 0) | 0;
 return;
}

function tb() {
 if ((d[8356] | 0 | 0) < 2) {
  a[8356] = 2;
  c[13] = 1;
  return;
 } else {
  c[13] = (c[13] | 0) + 1;
  return;
 }
}

function Eg(a) {
 a = a | 0;
 var b = 0, d = 0;
 d = i;
 i = i + 16 | 0;
 b = d;
 c[b >> 2] = a;
 i = d;
 return c[b >> 2] | 0;
}

function ui(b, c) {
 b = b | 0;
 c = c | 0;
 b = yi(b, c) | 0;
 return ((a[b >> 0] | 0) == (c & 255) << 24 >> 24 ? b : 0) | 0;
}

function Wd() {
 if (c[174] | 0) {
  Cd(c[(c[121] | 0) + (c[172] << 2) >> 2] | 0, 1);
  return;
 } else {
  yc();
  return;
 }
}

function Nh(a, b, c, d, e) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 e = e | 0;
 return sj(a, b, c, d, e, 1) | 0;
}

function _j(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 return cb[a & 7](b | 0, c | 0, d | 0) | 0;
}

function rj(a) {
 a = a | 0;
 if (a >>> 0 > 4294963200) {
  c[(Hi() | 0) >> 2] = 0 - a;
  a = -1;
 }
 return a | 0;
}

function Hi() {
 var a = 0;
 if (!(c[1841] | 0)) a = 7408; else a = c[(Ja() | 0) + 60 >> 2] | 0;
 return a | 0;
}

function Wh() {
 var a = 0, b = 0;
 b = i;
 i = i + 16 | 0;
 a = ta(20, b | 0) | 0;
 i = b;
 return a | 0;
}

function jd() {
 Vi(45, c[11] | 0) | 0;
 Vi(45, c[12] | 0) | 0;
 Xb();
 tb();
 bd(125, 37) | 0;
 return;
}

function Xj(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 return Zj(a, b, c, d, 0) | 0;
}

function Sb() {
 zb(c[11] | 0, c[118] | 0);
 zb(c[11] | 0, c[119] | 0);
 Vi(10, c[11] | 0) | 0;
 return;
}

function ei(a, b) {
 a = a | 0;
 b = b | 0;
 if (!a) a = 0; else a = di(a, b, 0) | 0;
 return a | 0;
}
function ib(a) {
 a = a | 0;
 var b = 0;
 b = i;
 i = i + a | 0;
 i = i + 15 & -16;
 return b | 0;
}

function Jb() {
 zb(c[11] | 0, c[292 + (c[72] << 2) >> 2] | 0);
 Vi(10, c[11] | 0) | 0;
 return;
}

function dk(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 return hb[a & 1](b | 0, c | 0) | 0;
}

function Ui(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 return Pi(a, 2147483647, b, c) | 0;
}

function Pb() {
 Ab(c[(c[116] | 0) + (c[115] << 2) >> 2] | 0);
 Ab(c[117] | 0);
 rb();
 return;
}

function ki(a) {
 a = a | 0;
 var b = 0;
 b = (ji(a) | 0) == 0;
 return (b ? a : a & 95) | 0;
}

function ii(a) {
 a = a | 0;
 var b = 0;
 b = (mi(a) | 0) == 0;
 return (b ? a : a | 32) | 0;
}

function ld() {
 Db();
 Qi(12543, c[11] | 0) | 0;
 Qi(12543, c[12] | 0) | 0;
 jd();
 return;
}

function pi(a, b) {
 a = a | 0;
 b = b | 0;
 zi(a + (si(a) | 0) | 0, b) | 0;
 return a | 0;
}

function gi(a) {
 a = a | 0;
 return ((a + -48 | 0) >>> 0 < 10 | (li(a) | 0) != 0) & 1 | 0;
}

function Qh(a) {
 a = a | 0;
 var b = 0;
 b = ai(c[a >> 2] | 0) | 0;
 Cj(a);
 return b | 0;
}

function Ai(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 Ei(a, b, c) | 0;
 return a | 0;
}

function Wb() {
 Qi(9993, c[11] | 0) | 0;
 Qi(9993, c[12] | 0) | 0;
 Ib();
 tb();
 return;
}

function Qi(a, b) {
 a = a | 0;
 b = b | 0;
 return (Ji(a, si(a) | 0, 1, b) | 0) + -1 | 0;
}

function zc() {
 Qi(10891, c[11] | 0) | 0;
 Qi(10891, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function sc() {
 Qi(10670, c[11] | 0) | 0;
 Qi(10670, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function rc() {
 Qi(10640, c[11] | 0) | 0;
 Qi(10640, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function bc() {
 Qi(10239, c[11] | 0) | 0;
 Qi(10239, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function Hc() {
 Qi(11155, c[11] | 0) | 0;
 Qi(11155, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function Ac() {
 Qi(10912, c[11] | 0) | 0;
 Qi(10912, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function $b() {
 Qi(10063, c[11] | 0) | 0;
 Qi(10063, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function ri(a, b) {
 a = a | 0;
 b = b | 0;
 return Fi(a, b, (si(a) | 0) + 1 | 0) | 0;
}

function ni(a) {
 a = a | 0;
 return ((a | 0) == 32 | (a + -9 | 0) >>> 0 < 5) & 1 | 0;
}

function Tb() {
 Qi(9922, c[11] | 0) | 0;
 Qi(9922, c[12] | 0) | 0;
 wb();
 xa(96, 1);
}

function yc() {
 Qi(10858, c[11] | 0) | 0;
 Qi(10858, c[12] | 0) | 0;
 wc();
 return;
}

function nc() {
 Qi(10517, c[11] | 0) | 0;
 Qi(10517, c[12] | 0) | 0;
 hc();
 return;
}

function kc() {
 Qi(10427, c[11] | 0) | 0;
 Qi(10427, c[12] | 0) | 0;
 hc();
 return;
}

function vb() {
 Qi(9388, c[11] | 0) | 0;
 Qi(9388, c[12] | 0) | 0;
 ub();
 return;
}

function Gd() {
 while (1) {
  if ((c[382] | 0) <= 0) break;
  Fd();
 }
 return;
}

function _b() {
 Qi(10024, c[11] | 0) | 0;
 Qi(10024, c[12] | 0) | 0;
 return;
}

function Ec() {
 Qi(11034, c[11] | 0) | 0;
 Qi(11034, c[12] | 0) | 0;
 return;
}

function ek(a, b, c) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 ba(0);
 return 0;
}

function Vb() {
 Qi(9981, c[11] | 0) | 0;
 Qi(9981, c[12] | 0) | 0;
 return;
}

function Ob() {
 Qi(9898, c[11] | 0) | 0;
 Qi(9898, c[12] | 0) | 0;
 return;
}

function Fb() {
 Qi(9671, c[11] | 0) | 0;
 Qi(9671, c[12] | 0) | 0;
 return;
}

function mb(a, b) {
 a = a | 0;
 b = b | 0;
 if (!n) {
  n = a;
  o = b;
 }
}

function zi(a, b) {
 a = a | 0;
 b = b | 0;
 vi(a, b) | 0;
 return a | 0;
}

function li(a) {
 a = a | 0;
 return ((a | 32) + -97 | 0) >>> 0 < 26 | 0;
}

function bk(a, b) {
 a = a | 0;
 b = b | 0;
 return fb[a & 3](b | 0) | 0;
}

function vj(a) {
 a = a | 0;
 if (!(c[a + 68 >> 2] | 0)) dj(a);
 return;
}

function tj(a) {
 a = a | 0;
 if (!(c[a + 68 >> 2] | 0)) dj(a);
 return;
}

function rb() {
 Vi(10, c[11] | 0) | 0;
 Vi(10, c[12] | 0) | 0;
 return;
}

function Ib() {
 Ab(c[292 + (c[72] << 2) >> 2] | 0);
 rb();
 return;
}

function mi(a) {
 a = a | 0;
 return (a + -65 | 0) >>> 0 < 26 | 0;
}

function ji(a) {
 a = a | 0;
 return (a + -97 | 0) >>> 0 < 26 | 0;
}

function Rb() {
 Ab(c[118] | 0);
 Ab(c[119] | 0);
 rb();
 return;
}

function jk(a, b) {
 a = a | 0;
 b = b | 0;
 ba(5);
 return 0;
}

function ak(a, b) {
 a = a | 0;
 b = b | 0;
 eb[a & 7](b | 0);
}

function Lh(a, b) {
 a = +a;
 b = b | 0;
 return +(+Mh(a, b));
}

function lb(a, b) {
 a = a | 0;
 b = b | 0;
 i = a;
 j = b;
}

function Db() {
 Cb(c[12] | 0);
 Cb(c[11] | 0);
 return;
}

function hi(a) {
 a = a | 0;
 return a >>> 0 < 128 | 0;
}

function Hd() {
 c[382] = 0;
 c[386] = c[22];
 return;
}

function $j(a) {
 a = a | 0;
 return db[a & 1]() | 0;
}

function hk(a) {
 a = a | 0;
 ba(3);
 return 0;
}

function ck(a) {
 a = a | 0;
 gb[a & 15]();
}

function ci(a) {
 a = a | 0;
 va(a | 0);
}

function cj(a) {
 a = a | 0;
 return 0;
}

function ub() {
 a[8356] = 3;
 return;
}

function ic() {
 gc();
 sb();
 return;
}

function Zb() {
 Xb();
 sb();
 return;
}

function dj(a) {
 a = a | 0;
 return;
}

function pb(a) {
 a = a | 0;
 C = a;
}

function kb(a) {
 a = a | 0;
 i = a;
}

function gk(a) {
 a = a | 0;
 ba(2);
}

function fk() {
 ba(1);
 return 0;
}

function qb() {
 return C | 0;
}

function jb() {
 return i | 0;
}

function ik() {
 ba(4);
}

// EMSCRIPTEN_END_FUNCS

 var cb = [ ek, Aj, kj, Si, _i, Ri, $i, ek ];
 var db = [ fk, id ];
 var eb = [ gk, We, $e, tj, vj, gk, gk, gk ];
 var fb = [ hk, Wi, kh, yb ];
 var gb = [ ik, Ke, Le, Me, Ib, Jb, ue, ve, we, Je, Pb, Ic, wb, ik, ik, ik ];
 var hb = [ jk, Qi ];
 return {
  _testSetjmp: Oj,
  _saveSetjmp: Mj,
  _free: Cj,
  _main: Qe,
  _realloc: Ej,
  _i64Add: Lj,
  _memmove: Qj,
  _i64Subtract: Ij,
  _memset: Jj,
  _malloc: Bj,
  _memcpy: Pj,
  _bitshift64Lshr: Nj,
  _fflush: ij,
  ___errno_location: Hi,
  _bitshift64Shl: Kj,
  runPostSets: Hj,
  stackAlloc: ib,
  stackSave: jb,
  stackRestore: kb,
  establishStackSpace: lb,
  setThrew: mb,
  setTempRet0: pb,
  getTempRet0: qb,
  dynCall_iiii: _j,
  dynCall_i: $j,
  dynCall_vi: ak,
  dynCall_ii: bk,
  dynCall_v: ck,
  dynCall_iii: dk
 };
})


// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var _testSetjmp = Module["_testSetjmp"] = asm["_testSetjmp"];
var _saveSetjmp = Module["_saveSetjmp"] = asm["_saveSetjmp"];
var _free = Module["_free"] = asm["_free"];
var _main = Module["_main"] = asm["_main"];
var _realloc = Module["_realloc"] = asm["_realloc"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _memset = Module["_memset"] = asm["_memset"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
Runtime.stackAlloc = asm["stackAlloc"];
Runtime.stackSave = asm["stackSave"];
Runtime.stackRestore = asm["stackRestore"];
Runtime.establishStackSpace = asm["establishStackSpace"];
Runtime.setTempRet0 = asm["setTempRet0"];
Runtime.getTempRet0 = asm["getTempRet0"];
function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}
ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;
var initialStackTop;
var preloadStartTime = null;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
 if (!Module["calledRun"]) run();
 if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};
Module["callMain"] = Module.callMain = function callMain(args) {
 assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
 assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
 args = args || [];
 ensureInitRuntime();
 var argc = args.length + 1;
 function pad() {
  for (var i = 0; i < 4 - 1; i++) {
   argv.push(0);
  }
 }
 var argv = [ allocate(intArrayFromString(Module["thisProgram"]), "i8", ALLOC_NORMAL) ];
 pad();
 for (var i = 0; i < argc - 1; i = i + 1) {
  argv.push(allocate(intArrayFromString(args[i]), "i8", ALLOC_NORMAL));
  pad();
 }
 argv.push(0);
 argv = allocate(argv, "i32", ALLOC_NORMAL);
 try {
  var ret = Module["_main"](argc, argv, 0);
  exit(ret, true);
 } catch (e) {
  if (e instanceof ExitStatus) {
   return;
  } else if (e == "SimulateInfiniteLoop") {
   Module["noExitRuntime"] = true;
   return;
  } else {
   if (e && typeof e === "object" && e.stack) Module.printErr("exception thrown: " + [ e, e.stack ]);
   throw e;
  }
 } finally {
  calledMain = true;
 }
};
function run(args) {
 args = args || Module["arguments"];
 if (preloadStartTime === null) preloadStartTime = Date.now();
 if (runDependencies > 0) {
  return;
 }
 preRun();
 if (runDependencies > 0) return;
 if (Module["calledRun"]) return;
 function doRun() {
  if (Module["calledRun"]) return;
  Module["calledRun"] = true;
  if (ABORT) return;
  ensureInitRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  if (Module["_main"] && shouldRunNow) Module["callMain"](args);
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout((function() {
   setTimeout((function() {
    Module["setStatus"]("");
   }), 1);
   doRun();
  }), 1);
 } else {
  doRun();
 }
}
Module["run"] = Module.run = run;
function exit(status, implicit) {
 if (implicit && Module["noExitRuntime"]) {
  return;
 }
 if (Module["noExitRuntime"]) {} else {
  ABORT = true;
  EXITSTATUS = status;
  STACKTOP = initialStackTop;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 if (ENVIRONMENT_IS_NODE) {
  process["stdout"]["once"]("drain", (function() {
   process["exit"](status);
  }));
  console.log(" ");
  setTimeout((function() {
   process["exit"](status);
  }), 500);
 } else if (ENVIRONMENT_IS_SHELL && typeof quit === "function") {
  quit(status);
 }
 throw new ExitStatus(status);
}
Module["exit"] = Module.exit = exit;
var abortDecorators = [];
function abort(what) {
 if (what !== undefined) {
  Module.print(what);
  Module.printErr(what);
  what = JSON.stringify(what);
 } else {
  what = "";
 }
 ABORT = true;
 EXITSTATUS = 1;
 var extra = "\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";
 var output = "abort(" + what + ") at " + stackTrace() + extra;
 if (abortDecorators) {
  abortDecorators.forEach((function(decorator) {
   output = decorator(output, what);
  }));
 }
 throw output;
}
Module["abort"] = Module.abort = abort;
if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}
var shouldRunNow = false;
if (Module["noInitialRun"]) {
 shouldRunNow = false;
}
run();
self["postMessage"](JSON.stringify({
 "command": "ready"
}));
Module["calledRun"] = false;
Module["thisProgram"] = "/bibtex";
FS.createDataFile("/", Module["thisProgram"], "dummy for kpathsea", true, true);




