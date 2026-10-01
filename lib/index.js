var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/cosmokit@1.8.1/node_modules/cosmokit/lib/index.cjs
var require_lib = __commonJS({
  "node_modules/.pnpm/cosmokit@1.8.1/node_modules/cosmokit/lib/index.cjs"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name2 in all)
        __defProp2(target, name2, { get: all[name2], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var index_exports = {};
    __export(index_exports, {
      Binary: () => Binary,
      Time: () => Time,
      arrayBufferToBase64: () => arrayBufferToBase64,
      arrayBufferToHex: () => arrayBufferToHex,
      base64ToArrayBuffer: () => base64ToArrayBuffer,
      camelCase: () => camelCase,
      camelize: () => camelize,
      capitalize: () => capitalize,
      clone: () => clone,
      contain: () => contain,
      deduplicate: () => deduplicate,
      deepEqual: () => deepEqual,
      defineProperty: () => defineProperty,
      difference: () => difference,
      filterKeys: () => filterKeys,
      formatProperty: () => formatProperty,
      hexToArrayBuffer: () => hexToArrayBuffer,
      hyphenate: () => hyphenate,
      intersection: () => intersection,
      is: () => is,
      isNonNullable: () => isNonNullable,
      isNullable: () => isNullable,
      isPlainObject: () => isPlainObject,
      makeArray: () => makeArray,
      mapValues: () => mapValues,
      noop: () => noop,
      omit: () => omit,
      paramCase: () => paramCase,
      pick: () => pick,
      remove: () => remove,
      sanitize: () => sanitize,
      snakeCase: () => snakeCase,
      trimSlash: () => trimSlash,
      uncapitalize: () => uncapitalize,
      union: () => union,
      valueMap: () => mapValues
    });
    module.exports = __toCommonJS(index_exports);
    function noop() {
    }
    function isNullable(value) {
      return value === null || value === void 0;
    }
    function isNonNullable(value) {
      return !isNullable(value);
    }
    function isPlainObject(data) {
      return data && typeof data === "object" && !Array.isArray(data);
    }
    function filterKeys(object2, filter) {
      return Object.fromEntries(Object.entries(object2).filter(([key, value]) => filter(key, value)));
    }
    function mapValues(object2, transform) {
      return Object.fromEntries(Object.entries(object2).map(([key, value]) => [key, transform(value, key)]));
    }
    function pick(source, keys, forced) {
      if (!keys) return { ...source };
      const result = {};
      for (const key of keys) {
        if (forced || source[key] !== void 0) result[key] = source[key];
      }
      return result;
    }
    function omit(source, keys) {
      if (!keys) return { ...source };
      const result = { ...source };
      for (const key of keys) {
        Reflect.deleteProperty(result, key);
      }
      return result;
    }
    function defineProperty(object2, key, value) {
      return Object.defineProperty(object2, key, { writable: true, value, enumerable: false });
    }
    function contain(array1, array2) {
      return array2.every((item) => array1.includes(item));
    }
    function intersection(array1, array2) {
      return array1.filter((item) => array2.includes(item));
    }
    function difference(array1, array2) {
      return array1.filter((item) => !array2.includes(item));
    }
    function union(array1, array2) {
      return Array.from(/* @__PURE__ */ new Set([...array1, ...array2]));
    }
    function deduplicate(array) {
      return [...new Set(array)];
    }
    function remove(list, item) {
      const index = list?.indexOf(item);
      if (index >= 0) {
        list.splice(index, 1);
        return true;
      } else {
        return false;
      }
    }
    function makeArray(source) {
      return Array.isArray(source) ? source : isNullable(source) ? [] : [source];
    }
    function is(type, value) {
      if (arguments.length === 1) return (value2) => is(type, value2);
      return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
    }
    function isArrayBufferLike(value) {
      return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
    }
    function isArrayBufferSource(value) {
      return isArrayBufferLike(value) || ArrayBuffer.isView(value);
    }
    var Binary;
    ((Binary2) => {
      Binary2.is = isArrayBufferLike;
      Binary2.isSource = isArrayBufferSource;
      function fromSource(source) {
        if (ArrayBuffer.isView(source)) {
          return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        } else {
          return source;
        }
      }
      Binary2.fromSource = fromSource;
      function toBase64(source) {
        source = fromSource(source);
        if (typeof Buffer !== "undefined") {
          return Buffer.from(source).toString("base64");
        }
        let binary = "";
        const bytes = new Uint8Array(source);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }
      Binary2.toBase64 = toBase64;
      function fromBase64(source) {
        if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
        return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
      }
      Binary2.fromBase64 = fromBase64;
      function toHex(source) {
        source = fromSource(source);
        if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
        return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      Binary2.toHex = toHex;
      function fromHex(source) {
        if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
        const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
        const buffer = [];
        for (let i = 0; i < hex.length; i += 2) {
          buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
        }
        return Uint8Array.from(buffer).buffer;
      }
      Binary2.fromHex = fromHex;
    })(Binary || (Binary = {}));
    var base64ToArrayBuffer = Binary.fromBase64;
    var arrayBufferToBase64 = Binary.toBase64;
    var hexToArrayBuffer = Binary.fromHex;
    var arrayBufferToHex = Binary.toHex;
    function clone(source, refs = /* @__PURE__ */ new Map()) {
      if (!source || typeof source !== "object") return source;
      if (is("Date", source)) return new Date(source.valueOf());
      if (is("RegExp", source)) return new RegExp(source.source, source.flags);
      if (isArrayBufferLike(source)) return source.slice(0);
      if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
      const cached = refs.get(source);
      if (cached) return cached;
      if (Array.isArray(source)) {
        const result2 = [];
        refs.set(source, result2);
        source.forEach((value, index) => {
          result2[index] = Reflect.apply(clone, null, [value, refs]);
        });
        return result2;
      }
      const result = Object.create(Object.getPrototypeOf(source));
      refs.set(source, result);
      for (const key of Reflect.ownKeys(source)) {
        const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
        if ("value" in descriptor) {
          descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
        }
        Reflect.defineProperty(result, key, descriptor);
      }
      return result;
    }
    function deepEqual(a, b, strict) {
      if (a === b) return true;
      if (!strict && isNullable(a) && isNullable(b)) return true;
      if (typeof a !== typeof b) return false;
      if (typeof a !== "object") return false;
      if (!a || !b) return false;
      function check(test, then) {
        return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
      }
      return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
        if (a2.byteLength !== b2.byteLength) return false;
        const viewA = new Uint8Array(a2);
        const viewB = new Uint8Array(b2);
        for (let i = 0; i < viewA.length; i++) {
          if (viewA[i] !== viewB[i]) return false;
        }
        return true;
      }) ?? Object.keys({ ...a, ...b }).every((key) => deepEqual(a[key], b[key], strict));
    }
    function capitalize(source) {
      return source.charAt(0).toUpperCase() + source.slice(1);
    }
    function uncapitalize(source) {
      return source.charAt(0).toLowerCase() + source.slice(1);
    }
    function camelCase(source) {
      return source.replace(/[_-][a-z]/g, (str) => str.slice(1).toUpperCase());
    }
    function tokenize(source, delimiters, delimiter) {
      const output = [];
      let state = 0;
      for (let i = 0; i < source.length; i++) {
        const code = source.charCodeAt(i);
        if (code >= 65 && code <= 90) {
          if (state === 1) {
            const next = source.charCodeAt(i + 1);
            if (next >= 97 && next <= 122) {
              output.push(delimiter);
            }
            output.push(code + 32);
          } else {
            if (state !== 0) {
              output.push(delimiter);
            }
            output.push(code + 32);
          }
          state = 1;
        } else if (code >= 97 && code <= 122) {
          output.push(code);
          state = 2;
        } else if (delimiters.includes(code)) {
          if (state !== 0) {
            output.push(delimiter);
          }
          state = 0;
        } else {
          output.push(code);
        }
      }
      return String.fromCharCode(...output);
    }
    function paramCase(source) {
      return tokenize(source, [45, 95], 45);
    }
    function snakeCase(source) {
      return tokenize(source, [45, 95], 95);
    }
    var camelize = camelCase;
    var hyphenate = paramCase;
    function formatProperty(key) {
      if (typeof key !== "string") return `[${key.toString()}]`;
      return /^[a-z_$][\w$]*$/i.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
    }
    function trimSlash(source) {
      return source.replace(/\/$/, "");
    }
    function sanitize(source) {
      if (!source.startsWith("/")) source = "/" + source;
      return trimSlash(source);
    }
    var Time;
    ((Time2) => {
      Time2.millisecond = 1;
      Time2.second = 1e3;
      Time2.minute = Time2.second * 60;
      Time2.hour = Time2.minute * 60;
      Time2.day = Time2.hour * 24;
      Time2.week = Time2.day * 7;
      let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
      function setTimezoneOffset(offset) {
        timezoneOffset = offset;
      }
      Time2.setTimezoneOffset = setTimezoneOffset;
      function getTimezoneOffset() {
        return timezoneOffset;
      }
      Time2.getTimezoneOffset = getTimezoneOffset;
      function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
        if (typeof date === "number") date = new Date(date);
        if (offset === void 0) offset = timezoneOffset;
        return Math.floor((date.valueOf() / Time2.minute - offset) / 1440);
      }
      Time2.getDateNumber = getDateNumber;
      function fromDateNumber(value, offset) {
        const date = new Date(value * Time2.day);
        if (offset === void 0) offset = timezoneOffset;
        return new Date(+date + offset * Time2.minute);
      }
      Time2.fromDateNumber = fromDateNumber;
      const numeric = /\d+(?:\.\d+)?/.source;
      const timeRegExp = new RegExp(`^${[
        "w(?:eek(?:s)?)?",
        "d(?:ay(?:s)?)?",
        "h(?:our(?:s)?)?",
        "m(?:in(?:ute)?(?:s)?)?",
        "s(?:ec(?:ond)?(?:s)?)?"
      ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
      function parseTime(source) {
        const capture = timeRegExp.exec(source);
        if (!capture) return 0;
        return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
      }
      Time2.parseTime = parseTime;
      function parseDate(date) {
        const parsed = parseTime(date);
        if (parsed) {
          date = Date.now() + parsed;
        } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
          date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
        } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) {
          date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
        }
        return date ? new Date(date) : /* @__PURE__ */ new Date();
      }
      Time2.parseDate = parseDate;
      function format(ms) {
        const abs = Math.abs(ms);
        if (abs >= Time2.day - Time2.hour / 2) {
          return Math.round(ms / Time2.day) + "d";
        } else if (abs >= Time2.hour - Time2.minute / 2) {
          return Math.round(ms / Time2.hour) + "h";
        } else if (abs >= Time2.minute - Time2.second / 2) {
          return Math.round(ms / Time2.minute) + "m";
        } else if (abs >= Time2.second) {
          return Math.round(ms / Time2.second) + "s";
        }
        return ms + "ms";
      }
      Time2.format = format;
      function toDigits(source, length = 2) {
        return source.toString().padStart(length, "0");
      }
      Time2.toDigits = toDigits;
      function template(template2, time = /* @__PURE__ */ new Date()) {
        return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
      }
      Time2.template = template;
    })(Time || (Time = {}));
  }
});

// node_modules/.pnpm/schemastery@3.18.0/node_modules/schemastery/lib/index.cjs
var require_lib2 = __commonJS({
  "node_modules/.pnpm/schemastery@3.18.0/node_modules/schemastery/lib/index.cjs"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
    var import_cosmokit = require_lib();
    var kSchema = Symbol.for("schemastery");
    var kValidationError = Symbol.for("ValidationError");
    globalThis.__schemastery_index__ ??= 0;
    globalThis.__schemastery_refs__ = void 0;
    var ValidationError = class extends TypeError {
      constructor(message, options) {
        let prefix = "$";
        for (const segment of options.path || []) {
          if (typeof segment === "string") {
            prefix += "." + segment;
          } else if (typeof segment === "number") {
            prefix += "[" + segment + "]";
          } else if (typeof segment === "symbol") {
            prefix += `[Symbol(${segment.toString()})]`;
          }
        }
        if (prefix.startsWith(".")) prefix = prefix.slice(1);
        super((prefix === "$" ? "" : `${prefix} `) + message);
        this.options = options;
      }
      static {
        __name(this, "ValidationError");
      }
      name = "ValidationError";
      static is(error) {
        return !!error?.[kValidationError];
      }
    };
    Object.defineProperty(ValidationError.prototype, kValidationError, {
      value: true
    });
    var Schema2 = /* @__PURE__ */ __name(function(options) {
      const schema = /* @__PURE__ */ __name(function(data, options2 = {}) {
        return Schema2.resolve(data, schema, options2)[0];
      }, "schema");
      if (options.refs) {
        const refs = (0, import_cosmokit.valueMap)(options.refs, (options2) => new Schema2(options2));
        const getRef = /* @__PURE__ */ __name((uid) => refs[uid], "getRef");
        for (const key in refs) {
          const options2 = refs[key];
          options2.sKey = getRef(options2.sKey);
          options2.inner = getRef(options2.inner);
          options2.list = options2.list && options2.list.map(getRef);
          options2.dict = options2.dict && (0, import_cosmokit.valueMap)(options2.dict, getRef);
        }
        return refs[options.uid];
      }
      Object.assign(schema, options);
      if (typeof schema.callback === "string") {
        try {
          schema.callback = new Function("return " + schema.callback)();
        } catch {
        }
      }
      Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
      Object.setPrototypeOf(schema, Schema2.prototype);
      schema.meta ||= {};
      schema.toString = schema.toString.bind(schema);
      return schema;
    }, "Schema");
    Schema2.prototype = Object.create(Function.prototype);
    Schema2.prototype[kSchema] = true;
    Object.defineProperty(Schema2.prototype, "~standard", {
      get() {
        return {
          version: 1,
          vendor: "schemastery",
          validate: /* @__PURE__ */ __name((value) => {
            try {
              return { value: Schema2.resolve(value, this, {})[0] };
            } catch (error) {
              if (ValidationError.is(error)) {
                return { issues: [{ message: error.message, path: error.options.path }] };
              }
              throw error;
            }
          }, "validate")
        };
      }
    });
    Schema2.ValidationError = ValidationError;
    Schema2.prototype.toJSON = /* @__PURE__ */ __name(function toJSON() {
      if (globalThis.__schemastery_refs__) {
        globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
        return this.uid;
      }
      globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
      globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
      const result = { uid: this.uid, refs: globalThis.__schemastery_refs__ };
      globalThis.__schemastery_refs__ = void 0;
      return result;
    }, "toJSON");
    Schema2.prototype.set = /* @__PURE__ */ __name(function set(key, value) {
      this.dict[key] = value;
      return this;
    }, "set");
    Schema2.prototype.push = /* @__PURE__ */ __name(function push(value) {
      this.list.push(value);
      return this;
    }, "push");
    function mergeDesc(original, messages) {
      const result = typeof original === "string" ? { "": original } : { ...original };
      for (const locale in messages) {
        const value = messages[locale];
        if (value?.$description || value?.$desc) {
          result[locale] = value.$description || value.$desc;
        } else if (typeof value === "string") {
          result[locale] = value;
        }
      }
      return result;
    }
    __name(mergeDesc, "mergeDesc");
    function getInner(value) {
      return value?.$value ?? value?.$inner;
    }
    __name(getInner, "getInner");
    function extractKeys(data) {
      return (0, import_cosmokit.filterKeys)(data ?? {}, (key) => !key.startsWith("$"));
    }
    __name(extractKeys, "extractKeys");
    Schema2.prototype.i18n = /* @__PURE__ */ __name(function i18n(messages) {
      const schema = Schema2(this);
      const desc = mergeDesc(schema.meta.description, messages);
      if (Object.keys(desc).length) schema.meta.description = desc;
      if (schema.dict) {
        schema.dict = (0, import_cosmokit.valueMap)(schema.dict, (inner, key) => {
          return inner.i18n((0, import_cosmokit.valueMap)(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
        });
      }
      if (schema.list) {
        schema.list = schema.list.map((inner, index) => {
          return inner.i18n((0, import_cosmokit.valueMap)(messages, (data = {}) => {
            if (Array.isArray(getInner(data))) return getInner(data)[index];
            if (Array.isArray(data)) return data[index];
            return extractKeys(data);
          }));
        });
      }
      if (schema.inner) {
        schema.inner = schema.inner.i18n((0, import_cosmokit.valueMap)(messages, (data) => {
          if (getInner(data)) return getInner(data);
          return extractKeys(data);
        }));
      }
      if (schema.sKey) {
        schema.sKey = schema.sKey.i18n((0, import_cosmokit.valueMap)(messages, (data) => data?.$key));
      }
      return schema;
    }, "i18n");
    Schema2.prototype.extra = /* @__PURE__ */ __name(function extra(key, value) {
      const schema = Schema2(this);
      schema.meta = { ...schema.meta, [key]: value };
      return schema;
    }, "extra");
    for (const key of ["required", "disabled", "collapse", "hidden", "loose"]) {
      Object.assign(Schema2.prototype, {
        [key](value = true) {
          const schema = Schema2(this);
          schema.meta = { ...schema.meta, [key]: value };
          return schema;
        }
      });
    }
    Schema2.prototype.deprecated = /* @__PURE__ */ __name(function deprecated() {
      const schema = Schema2(this);
      schema.meta.badges ||= [];
      schema.meta.badges.push({ text: "deprecated", type: "danger" });
      return schema;
    }, "deprecated");
    Schema2.prototype.experimental = /* @__PURE__ */ __name(function experimental() {
      const schema = Schema2(this);
      schema.meta.badges ||= [];
      schema.meta.badges.push({ text: "experimental", type: "warning" });
      return schema;
    }, "experimental");
    Schema2.prototype.pattern = /* @__PURE__ */ __name(function pattern(regexp) {
      const schema = Schema2(this);
      const pattern2 = (0, import_cosmokit.pick)(regexp, ["source", "flags"]);
      schema.meta = { ...schema.meta, pattern: pattern2 };
      return schema;
    }, "pattern");
    Schema2.prototype.simplify = /* @__PURE__ */ __name(function simplify(value) {
      if ((0, import_cosmokit.deepEqual)(value, this.meta.default, this.type === "dict")) return null;
      if ((0, import_cosmokit.isNullable)(value)) return value;
      if (this.type === "object" || this.type === "dict") {
        const result = {};
        for (const key in value) {
          const schema = this.type === "object" ? this.dict[key] : this.inner;
          const item = schema?.simplify(value[key]);
          if (this.type === "dict" || !(0, import_cosmokit.isNullable)(item)) result[key] = item;
        }
        if ((0, import_cosmokit.deepEqual)(result, this.meta.default, this.type === "dict")) return null;
        return result;
      } else if (this.type === "array" || this.type === "tuple") {
        const result = [];
        value.forEach((value2, index) => {
          const schema = this.type === "array" ? this.inner : this.list[index];
          const item = schema ? schema.simplify(value2) : value2;
          result.push(item);
        });
        return result;
      } else if (this.type === "intersect") {
        const result = {};
        for (const item of this.list) {
          Object.assign(result, item.simplify(value));
        }
        return result;
      } else if (this.type === "union") {
        for (const schema of this.list) {
          try {
            Schema2.resolve(value, schema, {});
            return schema.simplify(value);
          } catch {
          }
        }
      }
      return value;
    }, "simplify");
    Schema2.prototype.toString = /* @__PURE__ */ __name(function toString(inline) {
      return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
    }, "toString");
    Schema2.prototype.role = /* @__PURE__ */ __name(function role(role, extra2) {
      const schema = Schema2(this);
      schema.meta = { ...schema.meta, role, extra: extra2 };
      return schema;
    }, "role");
    for (const key of ["default", "link", "comment", "description", "max", "min", "step"]) {
      Object.assign(Schema2.prototype, {
        [key](value) {
          const schema = Schema2(this);
          schema.meta = { ...schema.meta, [key]: value };
          return schema;
        }
      });
    }
    var resolvers = {};
    Schema2.extend = /* @__PURE__ */ __name(function extend(type, resolve2) {
      resolvers[type] = resolve2;
    }, "extend");
    Schema2.resolve = /* @__PURE__ */ __name(function resolve(data, schema, options = {}, strict = false) {
      if (!schema) return [data];
      if (options.ignore?.(data, schema)) return [data];
      if ((0, import_cosmokit.isNullable)(data) && schema.type !== "lazy") {
        if (schema.meta.required) throw new ValidationError(`missing required value`, options);
        let current = schema;
        let fallback = schema.meta.default;
        while (current?.type === "intersect" && (0, import_cosmokit.isNullable)(fallback)) {
          current = current.list[0];
          fallback = current?.meta.default;
        }
        if ((0, import_cosmokit.isNullable)(fallback)) return [data];
        data = (0, import_cosmokit.clone)(fallback);
      }
      const callback = resolvers[schema.type];
      if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
      try {
        return callback(data, schema, options, strict);
      } catch (error) {
        if (!schema.meta.loose) throw error;
        return [schema.meta.default];
      }
    }, "resolve");
    Schema2.from = /* @__PURE__ */ __name(function from(source) {
      if ((0, import_cosmokit.isNullable)(source)) {
        return Schema2.any();
      } else if (["string", "number", "boolean"].includes(typeof source)) {
        return Schema2.const(source).required();
      } else if (source[kSchema]) {
        return source;
      } else if (typeof source === "function") {
        switch (source) {
          case String:
            return Schema2.string().required();
          case Number:
            return Schema2.number().required();
          case Boolean:
            return Schema2.boolean().required();
          case Function:
            return Schema2.function().required();
          default:
            return Schema2.is(source).required();
        }
      } else {
        throw new TypeError(`cannot infer schema from ${source}`);
      }
    }, "from");
    Schema2.lazy = /* @__PURE__ */ __name(function lazy(builder) {
      const toJSON2 = /* @__PURE__ */ __name(() => {
        if (!schema.inner[kSchema]) {
          schema.inner = schema.builder();
          schema.inner.meta = { ...schema.meta, ...schema.inner.meta };
        }
        return schema.inner.toJSON();
      }, "toJSON");
      const schema = new Schema2({ type: "lazy", builder, inner: { toJSON: toJSON2 } });
      return schema;
    }, "lazy");
    Schema2.natural = /* @__PURE__ */ __name(function natural() {
      return Schema2.number().step(1).min(0);
    }, "natural");
    Schema2.percent = /* @__PURE__ */ __name(function percent() {
      return Schema2.number().step(0.01).min(0).max(1).role("slider");
    }, "percent");
    Schema2.date = /* @__PURE__ */ __name(function date() {
      return Schema2.union([
        Schema2.is(Date),
        Schema2.transform(Schema2.string().role("datetime"), (value, options) => {
          const date2 = new Date(value);
          if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
          return date2;
        }, true)
      ]);
    }, "date");
    Schema2.regExp = /* @__PURE__ */ __name(function regExp(flag = "") {
      return Schema2.union([
        Schema2.is(RegExp),
        Schema2.transform(Schema2.string().role("regexp", { flag }), (value, options) => {
          try {
            return new RegExp(value, flag);
          } catch (e) {
            throw new ValidationError(e.message, options);
          }
        }, true)
      ]);
    }, "regExp");
    Schema2.arrayBuffer = /* @__PURE__ */ __name(function arrayBuffer(encoding) {
      return Schema2.union([
        Schema2.is(ArrayBuffer),
        Schema2.is(SharedArrayBuffer),
        Schema2.transform(Schema2.any(), (value, options) => {
          if (import_cosmokit.Binary.isSource(value)) return import_cosmokit.Binary.fromSource(value);
          throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
        }, true),
        ...encoding ? [Schema2.transform(Schema2.string(), (value, options) => {
          try {
            return encoding === "base64" ? import_cosmokit.Binary.fromBase64(value) : import_cosmokit.Binary.fromHex(value);
          } catch (e) {
            throw new ValidationError(e.message, options);
          }
        }, true)] : []
      ]);
    }, "arrayBuffer");
    Schema2.extend("lazy", (data, schema, options, strict) => {
      if (!schema.inner[kSchema]) {
        schema.inner = schema.builder();
        schema.inner.meta = { ...schema.meta, ...schema.inner.meta };
      }
      return Schema2.resolve(data, schema.inner, options, strict);
    });
    Schema2.extend("any", (data) => {
      return [data];
    });
    Schema2.extend("never", (data, _, options) => {
      throw new ValidationError(`expected nullable but got ${data}`, options);
    });
    Schema2.extend("const", (data, { value }, options) => {
      if ((0, import_cosmokit.deepEqual)(data, value)) return [value];
      throw new ValidationError(`expected ${value} but got ${data}`, options);
    });
    function checkWithinRange(data, meta, description, options, skipMin = false) {
      const { max = Infinity, min = -Infinity } = meta;
      if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
      if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
    }
    __name(checkWithinRange, "checkWithinRange");
    Schema2.extend("string", (data, { meta }, options) => {
      if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
      if (meta.pattern) {
        const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
        if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
      }
      checkWithinRange(data.length, meta, "string length", options);
      return [data];
    });
    function decimalShift(data, digits) {
      const str = data.toString();
      if (str.includes("e")) return data * Math.pow(10, digits);
      const index = str.indexOf(".");
      if (index === -1) return data * Math.pow(10, digits);
      const frac = str.slice(index + 1);
      const integer2 = str.slice(0, index);
      if (frac.length <= digits) return +(integer2 + frac.padEnd(digits, "0"));
      return +(integer2 + frac.slice(0, digits) + "." + frac.slice(digits));
    }
    __name(decimalShift, "decimalShift");
    function isMultipleOf(data, min, step) {
      step = Math.abs(step);
      if (!/^\d+\.\d+$/.test(step.toString())) {
        return (data - min) % step === 0;
      }
      const index = step.toString().indexOf(".");
      const digits = step.toString().slice(index + 1).length;
      return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
    }
    __name(isMultipleOf, "isMultipleOf");
    Schema2.extend("number", (data, { meta }, options) => {
      if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
      checkWithinRange(data, meta, "number", options);
      const { step } = meta;
      if (step && !isMultipleOf(data, meta.min ?? 0, step)) {
        throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
      }
      return [data];
    });
    Schema2.extend("boolean", (data, _, options) => {
      if (typeof data === "boolean") return [data];
      throw new ValidationError(`expected boolean but got ${data}`, options);
    });
    Schema2.extend("bitset", (data, { bits, meta }, options) => {
      let value = 0, keys = [];
      if (typeof data === "number") {
        value = data;
        for (const key in bits) {
          if (data & bits[key]) {
            keys.push(key);
          }
        }
      } else if (Array.isArray(data)) {
        keys = data;
        for (const key of keys) {
          if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
          if (key in bits) value |= bits[key];
        }
      } else {
        throw new ValidationError(`expected number or array but got ${data}`, options);
      }
      if (value === meta.default) return [value];
      return [value, keys];
    });
    Schema2.extend("function", (data, _, options) => {
      if (typeof data === "function") return [data];
      throw new ValidationError(`expected function but got ${data}`, options);
    });
    Schema2.extend("is", (data, { constructor }, options) => {
      if (typeof constructor === "function") {
        if (data instanceof constructor) return [data];
        throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
      } else {
        if ((0, import_cosmokit.isNullable)(data)) {
          throw new ValidationError(`expected ${constructor} but got ${data}`, options);
        }
        let prototype = Object.getPrototypeOf(data);
        while (prototype) {
          if (prototype.constructor?.name === constructor) return [data];
          prototype = Object.getPrototypeOf(prototype);
        }
        throw new ValidationError(`expected ${constructor} but got ${data}`, options);
      }
    });
    function property(data, key, schema, options) {
      try {
        const [value, adapted] = Schema2.resolve(data[key], schema, {
          ...options,
          path: [...options.path || [], key]
        });
        if (adapted !== void 0) data[key] = adapted;
        return value;
      } catch (e) {
        if (!options?.autofix) throw e;
        delete data[key];
        return schema.meta.default;
      }
    }
    __name(property, "property");
    Schema2.extend("array", (data, { inner, meta }, options) => {
      if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
      checkWithinRange(data.length, meta, "array length", options, !(0, import_cosmokit.isNullable)(inner.meta.default));
      return [data.map((_, index) => property(data, index, inner, options))];
    });
    Schema2.extend("dict", (data, { inner, sKey }, options, strict) => {
      if (!(0, import_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
      const result = {};
      for (const key in data) {
        let rKey;
        try {
          rKey = Schema2.resolve(key, sKey, options)[0];
        } catch (error) {
          if (strict) continue;
          throw error;
        }
        result[rKey] = property(data, key, inner, options);
        data[rKey] = data[key];
        if (key !== rKey) delete data[key];
      }
      return [result];
    });
    Schema2.extend("tuple", (data, { list }, options, strict) => {
      if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
      const result = list.map((inner, index) => property(data, index, inner, options));
      if (strict) return [result];
      result.push(...data.slice(list.length));
      return [result];
    });
    function merge(result, data) {
      for (const key in data) {
        if (key in result) continue;
        result[key] = data[key];
      }
    }
    __name(merge, "merge");
    Schema2.extend("object", (data, { dict }, options, strict) => {
      if (!(0, import_cosmokit.isPlainObject)(data)) throw new ValidationError(`expected object but got ${data}`, options);
      const result = {};
      for (const key in dict) {
        const value = property(data, key, dict[key], options);
        if (!(0, import_cosmokit.isNullable)(value) || key in data) {
          result[key] = value;
        }
      }
      if (!strict) merge(result, data);
      return [result];
    });
    Schema2.extend("union", (data, { list, toString: toString2 }, options, strict) => {
      const messages = [];
      for (const inner of list) {
        try {
          return Schema2.resolve(data, inner, options, strict);
        } catch (error) {
          messages.push(error);
        }
      }
      throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    });
    Schema2.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
      if (!list.length) return [data];
      let result;
      for (const inner of list) {
        const value = Schema2.resolve(data, inner, options, true)[0];
        if ((0, import_cosmokit.isNullable)(value)) continue;
        if ((0, import_cosmokit.isNullable)(result)) {
          result = value;
        } else if (typeof result !== typeof value) {
          throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
        } else if (typeof value === "object") {
          merge(result ??= {}, value);
        } else if (result !== value) {
          throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
        }
      }
      if (!strict && (0, import_cosmokit.isPlainObject)(data)) merge(result, data);
      return [result];
    });
    Schema2.extend("transform", (data, { inner, callback, preserve }, options) => {
      const [result, adapted = data] = Schema2.resolve(data, inner, options, true);
      if (preserve) {
        return [callback(result)];
      } else {
        return [callback(result), callback(adapted)];
      }
    });
    var formatters = {};
    function defineMethod(name2, keys, format) {
      formatters[name2] = format;
      Object.assign(Schema2, {
        [name2](...args) {
          const schema = new Schema2({ type: name2 });
          keys.forEach((key, index) => {
            switch (key) {
              case "sKey":
                schema.sKey = args[index] ?? Schema2.string();
                break;
              case "inner":
                schema.inner = Schema2.from(args[index]);
                break;
              case "list":
                schema.list = args[index].map(Schema2.from);
                break;
              case "dict":
                schema.dict = (0, import_cosmokit.valueMap)(args[index], Schema2.from);
                break;
              case "bits": {
                schema.bits = {};
                for (const key2 in args[index]) {
                  if (typeof args[index][key2] !== "number") continue;
                  schema.bits[key2] = args[index][key2];
                }
                break;
              }
              case "callback": {
                const callback = schema.callback = args[index];
                callback["toJSON"] ||= () => callback.toString();
                break;
              }
              case "constructor": {
                const constructor = schema.constructor = args[index];
                if (typeof constructor === "function") {
                  ;
                  constructor["toJSON"] ||= () => constructor["name"];
                }
                break;
              }
              default:
                schema[key] = args[index];
            }
          });
          if (name2 === "object" || name2 === "dict") {
            schema.meta.default = {};
          } else if (name2 === "array" || name2 === "tuple") {
            schema.meta.default = [];
          } else if (name2 === "bitset") {
            schema.meta.default = 0;
          }
          return schema;
        }
      });
    }
    __name(defineMethod, "defineMethod");
    defineMethod("is", ["constructor"], ({ constructor }) => {
      if (typeof constructor === "function") {
        return constructor.name;
      } else {
        return constructor;
      }
    });
    defineMethod("any", [], () => "any");
    defineMethod("never", [], () => "never");
    defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
    defineMethod("string", [], () => "string");
    defineMethod("number", [], () => "number");
    defineMethod("boolean", [], () => "boolean");
    defineMethod("bitset", ["bits"], () => "bitset");
    defineMethod("function", [], () => "function");
    defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
    defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
    defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
    defineMethod("object", ["dict"], ({ dict }) => {
      if (Object.keys(dict).length === 0) return "{}";
      return `{ ${Object.entries(dict).map(([key, inner]) => {
        return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
      }).join(", ")} }`;
    });
    defineMethod("union", ["list"], ({ list }, inline) => {
      const result = list.map(({ toString: format }) => format()).join(" | ");
      return inline ? `(${result})` : result;
    });
    defineMethod("intersect", ["list"], ({ list }) => {
      return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
    });
    defineMethod("transform", ["inner", "callback", "preserve"], ({ inner }, isInner) => inner.toString(isInner));
    module.exports = Schema2;
  }
});

// src/index.ts
var import_schemastery = __toESM(require_lib2(), 1);
import { homedir } from "node:os";
import { join as join2, isAbsolute as isAbsolute2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { readFile as readFile2 } from "node:fs/promises";

// src/broker.ts
import { randomBytes, timingSafeEqual } from "node:crypto";

// src/validation.ts
var DesktopError = class extends Error {
  constructor(message, code = "desktop-error", httpStatus = 409) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = "DesktopError";
  }
};
function object(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new DesktopError("Expected a JSON object", "bad-request", 400);
  return value;
}
function sessionId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)) throw new DesktopError("Invalid sessionId", "bad-session", 400);
  return value;
}
function epoch(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new DesktopError("A valid epoch is required; refresh status", "bad-epoch", 400);
  return value;
}
function number(value, name2, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new DesktopError(`${name2} must be ${min}..${max}`, "bad-input", 400);
  return value;
}
function button(value) {
  if (value !== "left" && value !== "middle" && value !== "right") throw new DesktopError("Invalid mouse button", "bad-input", 400);
  return value;
}
function controlAction(value) {
  if (typeof value !== "string" || !["start", "stop", "pause", "takeover", "release", "resume"].includes(value)) throw new DesktopError("Invalid control action", "bad-request", 400);
  return value;
}
function action(value, width, height) {
  const v = object(value);
  const point = () => ({ x: Math.round(number(v.x, "x", 0, width - 1)), y: Math.round(number(v.y, "y", 0, height - 1)) });
  const optionalPoint = () => v.x === void 0 && v.y === void 0 ? {} : point();
  switch (v.type) {
    case "move":
      return { type: "move", ...point() };
    case "click": {
      const count = v.count ?? 1;
      if (count !== 1 && count !== 2) throw new DesktopError("click count must be 1 or 2", "bad-input", 400);
      return { type: "click", ...point(), button: button(v.button ?? "left"), count };
    }
    case "button":
      if (typeof v.down !== "boolean") throw new DesktopError("down must be boolean", "bad-input", 400);
      return { type: "button", ...optionalPoint(), button: button(v.button), down: v.down };
    case "scroll":
      return { type: "scroll", ...optionalPoint(), deltaY: number(v.deltaY, "deltaY", -2e3, 2e3), deltaX: number(v.deltaX ?? 0, "deltaX", -2e3, 2e3) };
    case "press":
    case "key": {
      if (typeof v.key !== "string" || v.key.length < 1 || v.key.length > 64 || /[\u0000-\u001f]/.test(v.key)) throw new DesktopError("Invalid key event", "bad-input", 400);
      if (v.type === "key" && v.down !== void 0) {
        if (typeof v.down !== "boolean" || v.modifiers !== void 0) throw new DesktopError("Raw key needs boolean down and no modifiers; prefer press", "bad-input", 400);
        return { type: "key", key: v.key, down: v.down };
      }
      if (v.type === "press" && v.down !== void 0) throw new DesktopError("press is already a complete down/up pair; omit down", "bad-input", 400);
      const modifiers = v.modifiers ?? [];
      if (!Array.isArray(modifiers) || modifiers.length > 4 || modifiers.some((m) => !["Control", "Alt", "Shift", "Meta"].includes(m)) || new Set(modifiers).size !== modifiers.length) throw new DesktopError("Invalid press modifiers", "bad-input", 400);
      return { type: "press", key: v.key, modifiers };
    }
    case "release":
      return { type: "release" };
    case "text":
      if (typeof v.text !== "string" || v.text.length < 1 || v.text.length > 4e3 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(v.text)) throw new DesktopError("text must contain 1..4000 valid Unicode characters without unsupported control codes", "bad-input", 400);
      return { type: "text", text: v.text };
    default:
      throw new DesktopError("Unsupported input action", "bad-input", 400);
  }
}
function desktopSize(value) {
  const v = object(value);
  if (v.width === void 0 && v.height === void 0) return void 0;
  const width = number(v.width, "width", 320, 2560), height = number(v.height, "height", 240, 1600);
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new DesktopError("Desktop dimensions must be integers", "bad-size", 400);
  return { width, height };
}
function region(value, width, height) {
  if (value === void 0) return void 0;
  const v = object(value);
  const x = number(v.x, "region.x", 0, width - 1), y = number(v.y, "region.y", 0, height - 1);
  const w = number(v.width, "region.width", 1, width - x), h = number(v.height, "region.height", 1, height - y);
  if (![x, y, w, h].every(Number.isInteger)) throw new DesktopError("Region must use integer desktop pixels", "bad-region", 400);
  return { x, y, width: w, height: h };
}
function probePoints(value, width, height) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new DesktopError("Provide 1..32 probe points", "bad-probe", 400);
  return value.map((point) => {
    const p = object(point), x = number(p.x, "x", 0, width - 1), y = number(p.y, "y", 0, height - 1);
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new DesktopError("Probe points must be integer pixels", "bad-probe", 400);
    return { x, y };
  });
}
function windowId(value) {
  const id = number(value, "windowId", 2, 4294967295);
  if (!Number.isInteger(id)) throw new DesktopError("windowId must be an integer from desktop_windows", "bad-window", 400);
  return id;
}
var ROUTING_ENV = /^(DISPLAY|WAYLAND_DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_.*|SESSION_MANAGER|PULSE_.*|PIPEWIRE_.*|LD_PRELOAD|DSH_.*|SELKIES_.*|PIXELFLUX_.*|GDK_BACKEND|QT_QPA_PLATFORM)$/i;
function application(value, defaultCwd) {
  const v = object(value);
  if (typeof v.command !== "string" || !v.command.trim() || v.command.length > 4096 || v.command.includes("\0")) throw new DesktopError("command must be an executable, not a shell snippet", "bad-launch", 400);
  const args = v.args ?? [];
  if (!Array.isArray(args) || args.length > 128 || args.some((a) => typeof a !== "string" || a.length > 8192 || a.includes("\0"))) throw new DesktopError("Invalid argv", "bad-launch", 400);
  const cwd = v.cwd ?? defaultCwd;
  if (typeof cwd !== "string" || !cwd.startsWith("/") || cwd.includes("\0")) throw new DesktopError("cwd must be an absolute directory", "bad-launch", 400);
  const env = object(v.env ?? {});
  if (Object.keys(env).length > 80) throw new DesktopError("Too many environment overrides", "bad-launch", 400);
  const clean = {};
  for (const [key, value2] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ROUTING_ENV.test(key) || typeof value2 !== "string" || value2.includes("\0") || value2.length > 16384) throw new DesktopError(`Invalid or reserved environment key: ${key}`, "bad-launch", 400);
    clean[key] = value2;
  }
  return { command: v.command, args, cwd, env: clean };
}

// src/broker.ts
var DesktopBroker = class {
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.leaseTimer = setInterval(() => {
      void this.expireLeases();
    }, Math.min(1e3, options.humanLeaseMs));
    this.leaseTimer.unref?.();
  }
  records = /* @__PURE__ */ new Map();
  now;
  disposed = false;
  leaseTimer;
  get(id) {
    sessionId(id);
    let record = this.records.get(id);
    if (!record) {
      record = { status: { sessionId: id, state: "stopped", owner: "none", epoch: 0, backend: "native-x11", width: this.options.width, height: this.options.height }, tail: Promise.resolve(), humanUntil: 0, frameAt: 0 };
      this.records.set(id, record);
    }
    return record;
  }
  status(id, humanEpoch, capability) {
    const r = this.get(id);
    if (humanEpoch !== void 0) {
      this.assertHuman(id, humanEpoch, capability);
      r.humanUntil = this.now() + this.options.humanLeaseMs;
    }
    return structuredClone(r.status);
  }
  assertHuman(id, expected, capability) {
    const r = this.get(id);
    this.checkEpoch(r, expected);
    if (!capability || !/^[A-Za-z0-9_-]{32}$/.test(capability) || !r.controlToken || !timingSafeEqual(Buffer.from(capability), Buffer.from(r.controlToken))) throw new DesktopError("This viewer has no human input capability; explicitly take over", "not-controller", 403);
    if (r.status.owner !== "human" || r.humanUntil <= this.now()) throw new DesktopError("Human input lease expired; take over again", "lease-expired", 423);
  }
  queue(r, work) {
    const p = r.tail.then(work, work);
    r.tail = p.catch(() => {
    });
    return p;
  }
  checkEpoch(r, expected) {
    if (expected !== void 0 && expected !== r.status.epoch) throw new DesktopError("The desktop changed; refresh status and observe again", "stale-epoch");
  }
  requireOwner(r, owner, expected) {
    if (this.disposed) throw new DesktopError("Plugin is shutting down", "disposed", 503);
    this.checkEpoch(r, expected);
    if (r.status.state !== "running" || !r.backend) throw new DesktopError("The desktop is not running", "not-running");
    if (r.status.owner !== owner) throw new DesktopError(`Desktop input belongs to ${r.status.owner}; do not retry until explicitly resumed`, "not-owner", 423);
    if (owner === "human" && r.humanUntil <= this.now()) throw new DesktopError("Human input lease expired; take over again", "lease-expired", 423);
    return r.backend;
  }
  /** Invalidates old input immediately; succeeds only after the old queue and held keys settle. */
  async control(id, operation, cwd, expectedEpoch, signal, size) {
    if (this.disposed && operation !== "stop") throw new DesktopError("Plugin is shutting down", "disposed", 503);
    signal?.throwIfAborted();
    const r = this.get(id);
    this.checkEpoch(r, expectedEpoch);
    if (operation === "start") {
      const requestedSize = size ?? { width: r.status.width, height: r.status.height };
      if (!Number.isInteger(requestedSize.width) || !Number.isInteger(requestedSize.height) || requestedSize.width < 320 || requestedSize.width > 2560 || requestedSize.height < 240 || requestedSize.height > 1600) throw new DesktopError("Invalid desktop dimensions", "bad-size", 400);
      if (r.status.state === "running" || r.status.state === "starting") {
        if (size && (size.width !== r.status.width || size.height !== r.status.height)) throw new DesktopError("Live desktop resizing is not supported; save work and explicitly stop first. Human/paused ownership is not bypassed.", "already-running");
        return this.status(id);
      }
      if (r.status.state === "stopping") throw new DesktopError("Wait for the desktop to stop", "stopping");
      const count = [...this.records.values()].filter((v) => v !== r && (v.backend || ["starting", "running", "stopping"].includes(v.status.state))).length;
      if (count >= this.options.maxSessions) throw new DesktopError("Maximum active desktops reached; stop an owned desktop first", "session-limit");
      const startEpoch = ++r.status.epoch;
      r.status.width = requestedSize.width;
      r.status.height = requestedSize.height;
      r.status.windows = [];
      r.status.applications = [];
      delete r.status.lastFrameAt;
      delete r.status.lastActionAt;
      delete r.status.observedAt;
      delete r.status.inspectionError;
      delete r.status.input;
      r.status.focusedWindowId = null;
      r.status.activeWindowId = null;
      r.status.state = "starting";
      r.status.owner = "none";
      r.controlToken = void 0;
      r.humanUntil = 0;
      delete r.status.error;
      delete r.status.display;
      r.frame = void 0;
      r.startAbort = new AbortController();
      const startingSignal = signal ? AbortSignal.any([signal, r.startAbort.signal]) : r.startAbort.signal;
      return this.queue(r, async () => {
        if (r.backend) {
          try {
            await r.backend.stop();
          } catch (error) {
            r.status.state = "error";
            r.status.error = "Previous desktop cleanup failed; refusing a replacement";
            r.startAbort = void 0;
            throw error;
          }
          r.backend = void 0;
        }
        if (startingSignal.aborted) {
          if (r.status.state !== "stopping") {
            r.status.state = "stopped";
            r.status.owner = "none";
          }
          r.startAbort = void 0;
          startingSignal.throwIfAborted();
        }
        let backend;
        try {
          backend = this.options.createBackend(id, cwd, requestedSize);
        } catch (error) {
          r.status.state = "error";
          r.status.error = error instanceof Error ? error.message : String(error);
          r.startAbort = void 0;
          throw error;
        }
        r.backend = backend;
        backend.onExit?.((error) => {
          if (r.backend !== backend || r.status.state === "stopping" || r.status.state === "stopped") return;
          r.startAbort?.abort(error);
          r.controlToken = void 0;
          r.humanUntil = 0;
          r.status.owner = "none";
          r.status.epoch += 1;
          r.status.state = "error";
          r.status.error = error.message;
          r.frame = void 0;
          r.status.applications = r.status.applications?.map((app) => ({ ...app, running: false }));
        });
        try {
          const info = await backend.start(startingSignal);
          startingSignal.throwIfAborted();
          if (r.status.state !== "stopping") r.status.state = "running";
          r.status.display = info.display;
          r.status.startedAt = new Date(this.now()).toISOString();
          r.status.applications = [];
          if (r.status.epoch === startEpoch) r.status.owner = "agent";
          return this.status(id);
        } catch (error) {
          let cleanupFailed = false;
          try {
            await backend.stop();
            r.backend = void 0;
          } catch {
            cleanupFailed = true;
          }
          if (r.status.state !== "stopping") {
            r.status.state = "error";
            r.status.owner = "none";
            r.status.error = cleanupFailed ? "Startup and cleanup failed; owned backend retained for cleanup" : error instanceof Error ? error.message : String(error);
          }
          throw error;
        } finally {
          r.startAbort = void 0;
        }
      });
    }
    if (operation !== "stop" && !["running", "starting"].includes(r.status.state)) throw new DesktopError("Start the desktop first", "not-running");
    const controlEpoch = ++r.status.epoch;
    r.inputAbort?.abort(new Error("Input cancelled by desktop control transition"));
    r.status.owner = "none";
    r.humanUntil = 0;
    r.controlToken = void 0;
    r.frame = void 0;
    if (operation === "stop") {
      r.status.state = "stopping";
      r.startAbort?.abort(new Error("Desktop stopped during startup"));
    }
    return this.queue(r, async () => {
      if (operation === "stop") {
        await r.backend?.stop();
        r.backend = void 0;
        r.frame = void 0;
        r.status.state = "stopped";
        r.status.owner = "none";
        delete r.status.display;
        delete r.status.error;
        r.status.windows = [];
        r.status.applications = [];
        r.status.input = { heldKeys: [], heldButtons: [] };
        r.status.focusedWindowId = null;
        r.status.activeWindowId = null;
        delete r.status.inspectionError;
      } else {
        try {
          await r.backend?.release();
          r.status.input = { ...r.status.input, heldKeys: [], heldButtons: [] };
        } catch (error) {
          r.status.state = "error";
          r.status.error = "Could not release held input; desktop remains disabled";
          await r.backend?.stop().catch(() => {
          });
          throw error;
        }
        if (r.status.epoch === controlEpoch && r.status.state === "running") {
          if (operation === "takeover") {
            r.status.owner = "human";
            r.humanUntil = this.now() + this.options.humanLeaseMs;
            r.controlToken = randomBytes(24).toString("base64url");
          } else if (operation === "resume") r.status.owner = "agent";
        }
      }
      return { ...this.status(id), ...operation === "takeover" && r.status.epoch === controlEpoch && r.controlToken ? { controlToken: r.controlToken } : {} };
    });
  }
  async input(id, owner, expected, action2, signal, capability) {
    const r = this.get(id);
    this.requireOwner(r, owner, expected);
    if (owner === "human") this.assertHuman(id, expected, capability);
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      const backend = this.requireOwner(r, owner, expected);
      if (owner === "human") this.assertHuman(id, expected, capability);
      const operation = new AbortController();
      r.inputAbort = operation;
      const inputSignal = signal ? AbortSignal.any([signal, operation.signal]) : operation.signal;
      try {
        await backend.input(action2, inputSignal, owner);
        inputSignal.throwIfAborted();
        r.status.lastActionAt = new Date(this.now()).toISOString();
        r.frame = void 0;
        return this.status(id);
      } catch (error) {
        try {
          await backend.release();
        } catch (releaseError) {
          r.status.owner = "none";
          r.status.epoch++;
          r.controlToken = void 0;
          r.humanUntil = 0;
          r.status.state = "error";
          r.frame = void 0;
          r.status.error = `Input release could not be confirmed: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`;
          try {
            await backend.stop();
            if (r.backend === backend) r.backend = void 0;
            r.status.windows = [];
            r.status.input = { heldKeys: [], heldButtons: [] };
            r.status.focusedWindowId = null;
            r.status.activeWindowId = null;
            r.status.applications = r.status.applications?.map((app) => ({ ...app, running: false }));
          } catch (cleanupError) {
            r.status.error += `; cleanup still required: ${String(cleanupError)}`;
          }
        }
        throw error;
      } finally {
        if (r.inputAbort === operation) r.inputAbort = void 0;
      }
    });
  }
  async frame(id, expected, signal, options = {}) {
    const r = this.get(id);
    this.checkEpoch(r, expected);
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      this.checkEpoch(r, expected);
      if (r.status.state !== "running" || !r.backend) throw new DesktopError("No active desktop to capture", "not-running");
      const cacheable = options.region === void 0 && options.cursor !== false;
      if (cacheable && !options.fresh && r.frame && this.now() - r.frameAt < this.options.frameCacheMs) return { ...r.frame, cached: true };
      const result = await r.backend.frame(signal, options);
      this.checkEpoch(r, expected);
      if (cacheable) {
        r.frame = result;
        r.frameAt = this.now();
      }
      r.status.lastFrameAt = result.timestamp;
      if (result.inventory) this.installInventory(r, result.inventory);
      else if (result.windows) r.status.windows = result.windows;
      return { ...result, cached: false };
    });
  }
  installInventory(r, inventory2) {
    r.status.applications = inventory2.applications;
    r.status.windows = inventory2.windows;
    r.status.focusedWindowId = inventory2.focusedWindowId;
    r.status.activeWindowId = inventory2.activeWindowId;
    r.status.observedAt = inventory2.observedAt;
    r.status.input = inventory2.input;
    delete r.status.inspectionError;
  }
  /** Refresh launch-process/window facts; reading never acquires control. */
  async inspect(id, signal) {
    const r = this.get(id);
    if (r.status.state !== "running" || !r.backend?.inspect) return this.status(id);
    const expected = r.status.epoch, backend = r.backend;
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      if (r.status.state !== "running" || r.backend !== backend || r.status.epoch !== expected) return this.status(id);
      try {
        const inventory2 = await backend.inspect(signal);
        if (r.backend === backend && r.status.epoch === expected && r.status.state === "running") this.installInventory(r, inventory2);
      } catch (error) {
        if (signal?.aborted) throw error;
        r.status.inspectionError = error instanceof Error ? error.message : String(error);
      }
      return this.status(id);
    });
  }
  async probe(id, expected, points, signal) {
    const r = this.get(id);
    this.checkEpoch(r, expected);
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      this.checkEpoch(r, expected);
      if (r.status.state !== "running" || !r.backend?.probe) throw new DesktopError("No running pixel-probe backend", "not-running");
      const result = await r.backend.probe(points, signal);
      signal?.throwIfAborted();
      this.checkEpoch(r, expected);
      return result;
    });
  }
  async windowOperation(id, expected, operation, windowId2, signal) {
    const r = this.get(id);
    this.requireOwner(r, "agent", expected);
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      const backend = this.requireOwner(r, "agent", expected);
      const method = backend[operation];
      if (!method) throw new DesktopError("Window operation is not supported", "unsupported", 501);
      const abort = new AbortController();
      r.inputAbort = abort;
      const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
      try {
        const result = await method.call(backend, windowId2, combined);
        combined.throwIfAborted();
        this.checkEpoch(r, expected);
        r.frame = void 0;
        r.status.lastActionAt = new Date(this.now()).toISOString();
        if (backend.inspect) {
          try {
            this.installInventory(r, await backend.inspect(combined));
          } catch (error) {
            if (combined.aborted) throw error;
            r.status.inspectionError = error instanceof Error ? error.message : String(error);
          }
        }
        combined.throwIfAborted();
        this.checkEpoch(r, expected);
        return { status: this.status(id), result };
      } finally {
        if (r.inputAbort === abort) r.inputAbort = void 0;
      }
    });
  }
  async launch(id, expected, request, signal) {
    const r = this.get(id);
    this.requireOwner(r, "agent", expected);
    return this.queue(r, async () => {
      signal?.throwIfAborted();
      const backend = this.requireOwner(r, "agent", expected);
      const app = await backend.launch(request, signal);
      r.status.applications = [...(r.status.applications ?? []).slice(-31), { ...app, command: request.command, running: true }];
      return this.status(id);
    });
  }
  async releaseAgentInput(id) {
    const r = this.records.get(id);
    if (!r || r.status.owner !== "agent" || r.status.state !== "running") return;
    const expected = r.status.epoch;
    await this.queue(r, async () => {
      if (r.status.epoch === expected && r.status.owner === "agent" && r.status.state === "running") await r.backend?.release();
    });
  }
  async expireLeases() {
    await Promise.all([...this.records.entries()].filter(([, r]) => r.status.owner === "human" && r.humanUntil <= this.now()).map(async ([id, r]) => {
      await this.control(id, "release", "/", r.status.epoch).catch(() => {
      });
    }));
  }
  async dispose() {
    this.disposed = true;
    clearInterval(this.leaseTimer);
    const active = [...this.records.entries()].filter(([, r]) => r.backend || r.status.state === "starting");
    await Promise.allSettled(active.map(([id]) => this.control(id, "stop", "/")));
    this.disposed = true;
  }
};

// src/observations.ts
async function captureObservation(broker, id, save, signal, options = {}) {
  const expected = broker.status(id).epoch;
  const frame = await broker.frame(id, expected, signal, { ...options, fresh: options.fresh ?? true });
  const status = broker.status(id);
  if (status.epoch !== expected) throw new DesktopError("Desktop changed during capture; capture again", "stale-epoch");
  const image = await save(frame);
  signal.throwIfAborted();
  if (broker.status(id).epoch !== expected) throw new DesktopError("Desktop ownership changed while storing the image; capture again", "stale-epoch");
  return {
    status,
    frame: { ...frame.frameId ? { id: frame.frameId } : {}, capturedAt: frame.timestamp, cached: frame.cached === true, cursorOverlay: options.cursor !== false, region: frame.region ?? { x: 0, y: 0, width: frame.width, height: frame.height } },
    coordinates: { desktopWidth: status.width, desktopHeight: status.height, imageWidth: image.width, imageHeight: image.height, multiplyImageXBy: frame.width / image.width, multiplyImageYBy: frame.height / image.height, offsetX: frame.region?.x ?? 0, offsetY: frame.region?.y ?? 0 },
    image
  };
}

// src/native-backend.ts
import { access, mkdir, mkdtemp, readFile, rm, open } from "node:fs/promises";
import { constants } from "node:fs";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

// src/native-values.ts
function invalid(field) {
  throw new Error(`Invalid native ${field} response`);
}
function integer(value, field, min = 0, max = 4294967295) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(field);
  return value;
}
function bool(value, field) {
  if (typeof value !== "boolean") invalid(field);
  return value;
}
function nullableId(value, field) {
  return value === null ? null : integer(value, field, 1);
}
function text(value, field, max = 250) {
  if (typeof value !== "string" || value.length > max * 2) invalid(field);
  return value;
}
function isoTime(value, field) {
  const time = text(value, field, 64);
  if (!Number.isFinite(Date.parse(time))) invalid(field);
  return time;
}
function frameId(value) {
  const id = text(value, "frameId", 128);
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id)) invalid("frameId");
  return id;
}
function inventory(value) {
  const v = object(value);
  if (!Array.isArray(v.applications) || v.applications.length > 1024 || !Array.isArray(v.windows) || v.windows.length > 64) invalid("inventory");
  const observedAt = isoTime(v.observedAt, "observedAt");
  const input = object(v.input);
  if (!Array.isArray(input.heldKeys) || input.heldKeys.length > 256 || !Array.isArray(input.heldButtons) || input.heldButtons.length > 3) invalid("held input");
  return {
    observedAt,
    applications: v.applications.map((row) => {
      const a = object(row);
      if (!Array.isArray(a.windowIds) || a.windowIds.length > 64) invalid("application windows");
      return { id: text(a.id, "application id", 128), command: text(a.command, "command", 4096), pid: integer(a.pid, "pid", 1), running: bool(a.running, "running"), exitCode: a.exitCode === null ? null : integer(a.exitCode, "exitCode", -2147483648, 2147483647), observedAt: isoTime(a.observedAt, "application time"), windowIds: a.windowIds.map((id) => integer(id, "windowId", 1)) };
    }),
    windows: v.windows.map((row) => {
      const w = object(row), g = object(w.geometry);
      return { id: integer(w.id, "windowId", 1), title: text(w.title, "window title"), pid: nullableId(w.pid, "window pid"), mapped: bool(w.mapped, "mapped"), focusable: w.focusable === null ? null : bool(w.focusable, "focusable"), focused: bool(w.focused, "focused"), active: bool(w.active, "active"), modal: bool(w.modal, "modal"), transientFor: nullableId(w.transientFor, "transientFor"), supportsDelete: bool(w.supportsDelete, "supportsDelete"), geometry: { x: integer(g.x, "geometry.x", -2147483648, 2147483647), y: integer(g.y, "geometry.y", -2147483648, 2147483647), width: integer(g.width, "geometry.width", 0, 65535), height: integer(g.height, "geometry.height", 0, 65535) } };
    }),
    focusedWindowId: nullableId(v.focusedWindowId, "focusedWindowId"),
    activeWindowId: nullableId(v.activeWindowId, "activeWindowId"),
    input: { heldKeys: input.heldKeys.map((key) => text(key, "held key", 64)), heldButtons: input.heldButtons.map((button2) => {
      if (!["left", "middle", "right"].includes(String(button2))) invalid("held button");
      return button2;
    }), ...input.lastAutoReleaseAt == null ? {} : { lastAutoReleaseAt: isoTime(input.lastAutoReleaseAt, "auto release time") } }
  };
}
function pixelProbe(value, points) {
  const v = object(value);
  if (v.coordinateSpace !== "desktop" || v.cursorOverlay !== false || !Array.isArray(v.samples) || v.samples.length !== points.length) invalid("probe");
  const samples = v.samples.map((row, index) => {
    const sample = object(row), expected = points[index];
    if (sample.x !== expected.x || sample.y !== expected.y || !Array.isArray(sample.rgba) || sample.rgba.length !== 4) invalid("probe sample");
    const rgba = sample.rgba.map((channel) => integer(channel, "RGBA channel", 0, 255));
    return { x: expected.x, y: expected.y, rgba };
  });
  return { frameId: frameId(v.frameId), capturedAt: isoTime(v.capturedAt, "probe time"), coordinateSpace: "desktop", cursorOverlay: false, samples };
}
function windowOperation(value, expected) {
  const v = object(value);
  if (v.windowId !== expected) invalid("window operation target");
  return { windowId: expected, requested: bool(v.requested, "requested"), ...v.confirmed === void 0 ? {} : { confirmed: bool(v.confirmed, "confirmed") }, ...v.focusedWindowId === void 0 ? {} : { focusedWindowId: nullableId(v.focusedWindowId, "focusedWindowId") }, ...v.reason === void 0 ? {} : { reason: text(v.reason, "window operation reason", 1e3) } };
}

// src/native-backend.ts
var MAX_LINE = 24 * 1024 * 1024;
async function readNativePaths(root) {
  let value;
  try {
    value = object(JSON.parse(await readFile(join(root, "native.json"), "utf8")));
  } catch {
    throw new DesktopError(`Native runtime is not configured at ${root}. Run the documented setup-native command first.`, "runtime-missing", 503);
  }
  for (const key of ["python", "xvfb"]) {
    if (typeof value[key] !== "string" || !isAbsolute(value[key])) throw new DesktopError(`Invalid runtime executable: ${key}`, "runtime-invalid", 503);
    await access(value[key], constants.X_OK);
  }
  for (const key of ["windowManager", "terminal", "libraryPath", "binaryPath", "dataDirs"]) {
    if (value[key] !== void 0 && value[key] !== null && typeof value[key] !== "string") throw new DesktopError(`Invalid runtime field: ${key}`, "runtime-invalid", 503);
  }
  if (value.windowManagerArgs !== void 0 && (!Array.isArray(value.windowManagerArgs) || value.windowManagerArgs.some((v) => typeof v !== "string"))) throw new DesktopError("Invalid window manager argv", "runtime-invalid", 503);
  return {
    python: value.python,
    xvfb: value.xvfb,
    ...typeof value.windowManager === "string" ? { windowManager: value.windowManager } : {},
    ...Array.isArray(value.windowManagerArgs) ? { windowManagerArgs: value.windowManagerArgs } : {},
    ...typeof value.dataDirs === "string" ? { dataDirs: value.dataDirs } : {},
    ...typeof value.terminal === "string" ? { terminal: value.terminal } : {},
    ...typeof value.libraryPath === "string" ? { libraryPath: value.libraryPath } : {},
    ...typeof value.binaryPath === "string" ? { binaryPath: value.binaryPath } : {},
    ...typeof value.selkies === "string" ? { selkies: value.selkies } : {}
  };
}
var NativeBackend = class {
  constructor(options) {
    this.options = options;
  }
  handle;
  counter = 0;
  pending = /* @__PURE__ */ new Map();
  buffer = "";
  intentionalStop = false;
  failed = false;
  exitHandler;
  paths;
  stateDir;
  onExit(handler) {
    this.exitHandler = handler;
  }
  async start(signal) {
    signal?.throwIfAborted();
    this.paths = await readNativePaths(this.options.runtimeRoot);
    await mkdir(this.options.stateRoot, { recursive: true, mode: 448 });
    const stateDir = this.stateDir = await mkdtemp(join(this.options.stateRoot, "desktop-"));
    const worker = this.options.workerPath ?? fileURLToPath(new URL("../runtime/desktop_worker.py", import.meta.url));
    const env = {
      PYTHONUNBUFFERED: "1",
      PYTHONNOUSERSITE: "1",
      PYTHONPATH: void 0,
      PYTHONHOME: void 0,
      LD_PRELOAD: void 0,
      LD_LIBRARY_PATH: void 0
    };
    this.handle = this.options.spawn({
      argv: [this.paths.python, "-u", worker],
      cwd: this.options.cwd,
      stdio: { stdin: "pipe", stdout: "pipe", stderr: { maxBytes: 16384 } },
      graceMs: 5e3,
      env
    });
    if (!this.handle.stdout || !this.handle.stdin) throw new Error("Native runtime requires local stdio pipes");
    this.handle.stdin.on("error", (error) => this.exited(error));
    this.handle.stdout.on("error", (error) => this.exited(error));
    this.handle.stdout.setEncoding("utf8");
    this.handle.stdout.on("data", (data) => this.consume(data));
    void this.handle.done.then((outcome) => this.exited(new Error(`Desktop worker exited (${outcome.exitCode ?? outcome.signal})`)), (error) => this.exited(error instanceof Error ? error : new Error(String(error))));
    const result = object(await this.call("start", { config: { paths: this.paths, stateDir, cwd: this.options.cwd, width: this.options.width, height: this.options.height, startTerminal: this.options.startTerminal, agentKeyHoldMs: this.options.agentKeyHoldMs ?? 1500 } }, signal, 25e3));
    if (typeof result.display !== "string" || !/^:\d+$/.test(result.display)) throw new Error("Worker did not return its owned display");
    return { display: result.display };
  }
  exited(error) {
    if (this.failed) return;
    this.failed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.detach();
      p.reject(error);
    }
    this.pending.clear();
    if (!this.intentionalStop) {
      this.handle?.terminate();
      this.exitHandler?.(error);
    }
  }
  consume(chunk) {
    this.buffer += chunk;
    if (this.buffer.length > MAX_LINE) {
      this.handle?.terminate();
      this.exited(new Error("Native response exceeded byte limit"));
      return;
    }
    let index;
    while ((index = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      let response;
      try {
        response = object(JSON.parse(line));
      } catch {
        this.handle?.terminate();
        this.exited(new Error("Invalid desktop worker protocol"));
        return;
      }
      const p = this.pending.get(Number(response.id));
      if (!p) continue;
      this.pending.delete(Number(response.id));
      clearTimeout(p.timer);
      p.detach();
      if (response.ok === true) p.resolve(response.result);
      else p.reject(new Error(typeof response.error === "string" ? response.error : "Native operation failed"));
    }
  }
  call(op, payload = {}, signal, timeout = 15e3) {
    signal?.throwIfAborted();
    const handle = this.handle;
    if (this.failed || !handle?.stdin || handle.stdin.destroyed) return Promise.reject(new Error("Desktop worker is unavailable"));
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (!handle.stdin?.destroyed) handle.stdin?.write(JSON.stringify({ op: "cancel", id }) + "\n", (error) => {
          if (error) this.exited(error);
        });
      };
      const timer = setTimeout(() => {
        this.pending.delete(id);
        signal?.removeEventListener("abort", abort);
        handle.terminate();
        const diagnostic = handle.collected.stderr?.readFrom(0).text.slice(-2e3) ?? "";
        reject(new Error(`Native ${op} timed out; desktop stopped to prevent late input${diagnostic ? "\n" + diagnostic : ""}`));
      }, timeout);
      const detach = () => signal?.removeEventListener("abort", abort);
      this.pending.set(id, { resolve: (value) => {
        if (signal?.aborted) reject(signal.reason instanceof Error ? signal.reason : new Error("Cancelled"));
        else resolve(value);
      }, reject, timer, detach });
      signal?.addEventListener("abort", abort, { once: true });
      handle.stdin.write(JSON.stringify({ id, op, ...payload }) + "\n", (error) => {
        if (!error) return;
        const p = this.pending.get(id);
        if (p) {
          this.pending.delete(id);
          clearTimeout(p.timer);
          p.detach();
          p.reject(error);
        }
      });
    });
  }
  async frame(signal, options = {}) {
    const result = object(await this.call("frame", { options: { ...options.region ? { region: options.region } : {}, cursor: options.cursor !== false } }, signal));
    if (result.imageFile !== "frame.png" || !this.stateDir) throw new Error("Worker returned no owned PNG frame");
    const file = await open(join(this.stateDir, "frame.png"), constants.O_RDONLY | constants.O_NOFOLLOW);
    let data;
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size < 24 || info.size > 16 * 1024 * 1024) throw new Error("Invalid or oversized owned frame file");
      data = await file.readFile();
    } finally {
      await file.close();
    }
    if (data.length > 16 * 1024 * 1024 || data.length < 24 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Invalid or oversized desktop frame");
    const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
    const region2 = options.region ?? { x: 0, y: 0, width: this.options.width, height: this.options.height };
    if (width !== region2.width || height !== region2.height) throw new Error("Desktop capture dimensions changed unexpectedly");
    const returnedRegion = object(result.region);
    for (const key of ["x", "y", "width", "height"]) if (returnedRegion[key] !== region2[key]) throw new Error("Native capture region mismatch");
    if (typeof result.timestamp !== "number" || !Number.isFinite(result.timestamp) || result.timestamp <= 0 || result.timestamp > 864e10) throw new Error("Invalid capture time");
    const details = inventory(result);
    return { data, width, height, timestamp: new Date(result.timestamp * 1e3).toISOString(), frameId: frameId(result.frameId), region: region2, windows: details.windows, inventory: details };
  }
  async input(action2, signal, actor = "agent") {
    await this.call("input", { action: action2, actor }, signal);
  }
  async inspect(signal) {
    return inventory(await this.call("inspect", {}, signal));
  }
  async probe(points, signal) {
    return pixelProbe(await this.call("probe", { points }, signal), points);
  }
  async focus(windowId2, signal) {
    return windowOperation(await this.call("focus", { windowId: windowId2 }, signal), windowId2);
  }
  async closeWindow(windowId2, signal) {
    return windowOperation(await this.call("closeWindow", { windowId: windowId2 }, signal), windowId2);
  }
  async release() {
    await this.call("release");
  }
  async launch(request, signal) {
    const result = object(await this.call("launch", { request }, signal));
    if (typeof result.id !== "string" || !Number.isSafeInteger(result.pid)) throw new Error("Invalid application launch response");
    return { id: result.id, pid: result.pid };
  }
  async stop() {
    this.intentionalStop = true;
    if (!this.handle) return;
    try {
      await this.call("stop", {}, void 0, 6e3);
    } catch {
    }
    this.handle.terminate();
    const stopped = await this.handle.waitForExit(AbortSignal.timeout(8e3));
    if (!stopped) throw new Error("Desktop worker did not stop within the cleanup budget");
    await this.handle.done.catch(() => {
    });
    if (this.stateDir) await rm(join(this.stateDir, "Xauthority"), { force: true });
    this.handle = void 0;
  }
};

// src/index.ts
var name = "agent-desktop";
var inject = ["tools", "subprocess", "sessions", "sandboxPolicy"];
var Config = import_schemastery.default.object({
  runtimeRoot: import_schemastery.default.string().description("User-local runtime directory containing native.json."),
  stateRoot: import_schemastery.default.string().description("Private owned session state/log directory."),
  width: import_schemastery.default.natural().min(320).max(2560).default(1280),
  height: import_schemastery.default.natural().min(240).max(1600).default(800),
  maxSessions: import_schemastery.default.natural().min(1).max(4).default(2),
  humanLeaseMs: import_schemastery.default.natural().min(3e3).max(6e4).default(1e4),
  frameCacheMs: import_schemastery.default.natural().min(100).max(2e3).default(300),
  agentKeyHoldMs: import_schemastery.default.natural().min(100).max(1e4).default(1500).description("Maximum raw agent key hold; atomic press is recommended."),
  startTerminal: import_schemastery.default.boolean().default(true)
});
function apply(ctx, config = {}) {
  const runtimeRoot = config.runtimeRoot ?? fileURLToPath2(new URL("../.runtime/", import.meta.url));
  const stateRoot = config.stateRoot ?? join2(homedir(), ".local/state/dsh-agent-desktop");
  if (!isAbsolute2(runtimeRoot) || !isAbsolute2(stateRoot)) throw new Error("agent-desktop runtimeRoot/stateRoot must be absolute");
  const width = config.width ?? 1280, height = config.height ?? 800;
  const broker = new DesktopBroker({
    width,
    height,
    maxSessions: config.maxSessions ?? 2,
    humanLeaseMs: config.humanLeaseMs ?? 1e4,
    frameCacheMs: config.frameCacheMs ?? 300,
    createBackend: (_id, cwd, size) => new NativeBackend({ runtimeRoot, stateRoot, cwd, width: size.width, height: size.height, startTerminal: config.startTerminal ?? true, agentKeyHoldMs: config.agentKeyHoldMs ?? 1500, spawn: (spec) => ctx.subprocess.spawn(spec) })
  });
  ctx.effect(() => () => broker.dispose(), "agent-desktop.native-lifetime");
  ctx.on("agent/status", ({ agent, status }) => {
    if (status === "idle") void broker.releaseAgentInput(String(agent.session.id)).catch(() => {
    });
  });
  const metadata = (exec, mutate) => {
    const session = exec.agent?.session;
    if (!session?.header.cwd) throw new DesktopError("A live DSH session with a working directory is required", "session-required", 400);
    if (mutate && ctx.sandboxPolicy.resolve({ session }).mode !== "danger-full-access") throw new DesktopError("Host-native desktop actions require danger-full-access. \u8BF7\u5728\u5F53\u524D\u4F1A\u8BDD\u7684\u6743\u9650/\u8BBF\u95EE\u6A21\u5F0F\u83DC\u5355\u4E2D\u9009\u62E9\u201C\u5B8C\u5168\u6743\u9650\u201D\u3002No automatic escalation is performed.", "permission-denied", 403);
    exec.signal.throwIfAborted();
    return { id: String(session.id), cwd: session.header.cwd };
  };
  const register = (definition) => ctx.tools.register(definition);
  const textOutput = { schema: { type: "object", additionalProperties: true }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] };
  const params = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
  const epochProperty = { type: "integer", description: "Current desktop epoch from status/screenshot; old epochs are rejected." };
  register({
    name: "desktop_start",
    description: "Start this session\u2019s private Linux desktop using host-installed software, not the user\u2019s physical screen. Requires danger-full-access. Existing paused or human-owned desktops are not resumed by this tool.",
    parameters: params({ cwd: { type: "string", description: "Optional absolute initial directory; defaults to this DSH session directory." }, width: { type: "integer", description: "Optional desktop width 320..2560. Supply together with height. Applied only to a new/stopped desktop; e.g. 1600 for drawing/IDE." }, height: { type: "integer", description: "Optional height 240..1600, paired with width. Live desktops are never automatically resized." } }),
    output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args), cwd = v.cwd ?? meta.cwd;
      if (typeof cwd !== "string" || !isAbsolute2(cwd)) throw new DesktopError("cwd must be absolute", "bad-cwd", 400);
      return broker.control(meta.id, "start", cwd, void 0, exec.signal, desktopSize(v));
    }
  });
  register({
    name: "desktop_status",
    description: "Read this session\u2019s desktop owner/epoch and refresh window focus, held input and tracked launch-process state. running describes the launch process, not all descendant GUI windows. No input control is acquired.",
    parameters: params({}),
    output: textOutput,
    async execute(_args, exec) {
      return broker.inspect(metadata(exec, false).id, exec.signal);
    }
  });
  register({
    name: "desktop_action",
    description: 'Prefer press for one atomic down/up key or shortcut, e.g. {type:"press",key:"Enter"} or key:"s",modifiers:["Control"]. Raw key down:true HOLDS a key: pair immediately with down:false; agent holds suppress repeat and expire. Use release to clear only this worker\u2019s held input. Observe first and use current epoch; paused/human control is not bypassed. text maps newline to Enter and tab to Tab, each paired, without clipboard sync.',
    parameters: params({ epoch: epochProperty, action: { type: "object", description: "move/click/button/scroll/press/key/release/text. Use press for single keys/shortcuts; key without down also means press. Explicit key down is an advanced hold, not a complete keystroke. Coordinates are absolute desktop pixels: apply screenshot offsets and multipliers for a crop/downscale. button needs down; text max 4000 UTF-16 characters.", properties: { type: { type: "string", enum: ["move", "click", "button", "scroll", "press", "key", "release", "text"] }, x: { type: "number" }, y: { type: "number" }, button: { type: "string", enum: ["left", "middle", "right"] }, count: { type: "integer", enum: [1, 2] }, deltaX: { type: "number" }, deltaY: { type: "number" }, key: { type: "string" }, modifiers: { type: "array", items: { type: "string", enum: ["Control", "Alt", "Shift", "Meta"] }, description: "Atomic press modifiers; do not combine with raw down/up." }, down: { type: "boolean" }, text: { type: "string" } }, required: ["type"], additionalProperties: false } }, ["epoch", "action"]),
    output: textOutput,
    async execute(args, exec) {
      const { id } = metadata(exec, true), v = object(args), current = broker.status(id);
      return broker.input(id, "agent", epoch(v.epoch), action(v.action, current.width, current.height), exec.signal);
    }
  });
  register({
    name: "desktop_launch",
    description: "Launch an already-installed host executable in this session\u2019s private desktop. Reuses existing application/development paths. Use argv, not a shell command. cwd selects the actual application working directory; relative file paths resolve there. Graphical routing env is reserved; single-instance apps may need a separate UI profile. Requires agent control and danger-full-access.",
    parameters: params({ epoch: epochProperty, command: { type: "string" }, args: { type: "array", items: { type: "string" } }, cwd: { type: "string" }, env: { type: "object", additionalProperties: { type: "string" } } }, ["epoch", "command"]),
    output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args);
      return broker.launch(meta.id, epoch(v.epoch), application(v, meta.cwd), exec.signal);
    }
  });
  register({
    name: "desktop_stop",
    description: "Stop only this session\u2019s owned private desktop and its applications. Unsaved work is lost. Use only when the user requested stopping and confirm is true; refused during human ownership or pause. Closing the preview does not require this tool.",
    parameters: params({ epoch: epochProperty, confirm: { type: "boolean", description: "True only when stopping these applications is intended." } }, ["epoch", "confirm"]),
    output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args);
      if (v.confirm !== true) throw new DesktopError("Explicit stop confirmation is required", "confirmation-required", 400);
      if (broker.status(meta.id).owner !== "agent") throw new DesktopError("Use the human desktop panel to stop a paused or human-owned session", "not-owner", 423);
      return broker.control(meta.id, "stop", meta.cwd, epoch(v.epoch), exec.signal);
    }
  });
  register({
    name: "desktop_windows",
    description: "Refresh this session\u2019s managed windows, current X input focus, modal/transient hints, worker-held keys/buttons and exact launch-process states. Focusable is a hint, not proof that no application grab exists. Does not acquire control or capture the physical desktop.",
    parameters: params({}),
    output: textOutput,
    async execute(_args, exec) {
      return broker.inspect(metadata(exec, false).id, exec.signal);
    }
  });
  register({
    name: "desktop_focus",
    description: "Request normal window-manager activation for an id from a fresh desktop_windows result. Requires agent ownership and current epoch. Does not force focus past modal dialogs or defeat input grabs; inspect confirmed/current focus and capture again before typing.",
    parameters: params({ epoch: epochProperty, windowId: { type: "integer" } }, ["epoch", "windowId"]),
    output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args);
      return broker.windowOperation(meta.id, epoch(v.epoch), "focus", windowId(v.windowId), exec.signal);
    }
  });
  register({
    name: "desktop_close_window",
    description: "Ask one current managed window to close using WM_DELETE_WINDOW only. confirm=true means the user authorized that close and its unsaved-data risk. No process kill, no forced close, no automatic discard. The application may show a save dialog or close multiple documents; requested does not mean closed. Requires agent ownership.",
    parameters: params({ epoch: epochProperty, windowId: { type: "integer" }, confirm: { type: "boolean" } }, ["epoch", "windowId", "confirm"]),
    output: textOutput,
    async execute(args, exec) {
      const meta = metadata(exec, true), v = object(args);
      if (v.confirm !== true) throw new DesktopError("Explicit window-close confirmation is required", "confirmation-required", 400);
      return broker.windowOperation(meta.id, epoch(v.epoch), "closeWindow", windowId(v.windowId), exec.signal);
    }
  });
  register({
    name: "desktop_probe",
    description: "Sample 1..32 absolute desktop-pixel points from one fresh private capture, without the synthetic pointer overlay. Returns RGBA, frame id and capture time. These are composited screen colors (alpha 255), NOT source-file/layer pixels; a few colors cannot prove visual semantics. Read-only even while paused/human-owned.",
    parameters: params({ epoch: epochProperty, points: { type: "array", items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false } } }, ["epoch", "points"]),
    output: textOutput,
    async execute(args, exec) {
      const { id } = metadata(exec, false), v = object(args), current = broker.status(id);
      const sampled = await broker.probe(id, epoch(v.epoch), probePoints(v.points, current.width, current.height), exec.signal);
      return { status: broker.status(id), ...sampled };
    }
  });
  ctx.inject(["attachments"], (scope) => {
    scope.tools.register({
      name: "desktop_screenshot",
      description: "Capture this private desktop, fresh by default, with frame id/time/cache flag. Optional region crops absolute desktop pixels; apply coordinate offsets AND multipliers before input. cursor=false excludes the synthetic pointer. Identical pixels/hashes may be correct for an unchanged screen. fresh=false permits the short UI cache. Works without a viewer and never acquires control.",
      parameters: params({ fresh: { type: "boolean", description: "Default true; false explicitly permits the frame cache." }, cursor: { type: "boolean", description: "Default true; false removes the synthetic pointer overlay." }, region: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, height: { type: "integer" } }, required: ["x", "y", "width", "height"], additionalProperties: false } }),
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => {
          const result = object(value);
          return [{ type: "text", text: JSON.stringify({ status: result.status, frame: result.frame, coordinates: result.coordinates }) }, { type: "image", attachment: result.image }];
        }
      },
      async execute(args, exec) {
        const { id } = metadata(exec, false), v = object(args), current = broker.status(id);
        if (v.fresh !== void 0 && typeof v.fresh !== "boolean" || v.cursor !== void 0 && typeof v.cursor !== "boolean") throw new DesktopError("fresh/cursor must be boolean", "bad-request", 400);
        const route = exec.agent?.session.requestHeader()?.config;
        const provider = route?.provider ?? exec.agent?.options.provider, model = route?.model ?? exec.agent?.options.model;
        const llm = scope.get("llm");
        if (!provider || !model || !llm || !(await llm.resolveModelInfo(provider, model, exec.signal)).inputModalities?.includes("image")) throw new DesktopError("Select an image-capable model before requesting a desktop screenshot", "image-route-required", 400);
        return captureObservation(broker, id, (frame) => scope.attachments.saveImage({ data: frame.data, mediaType: "image/png", name: "agent-desktop.png" }), exec.signal, { fresh: v.fresh, cursor: v.cursor, region: region(v.region, current.width, current.height) });
      }
    });
  });
  ctx.inject(["webServer", "connection"], (scope) => {
    const route = createHandler({
      broker,
      width,
      height,
      reject: (req) => scope.connection.requestRejection(req),
      directory: (id) => {
        const attached = ctx.sessions.get(id);
        if (!attached?.header.cwd) throw new DesktopError("Open this DSH session before using its desktop panel", "session-not-loaded", 404);
        return attached.header.cwd;
      },
      stylePath: fileURLToPath2(new URL("./client.css", import.meta.url))
    });
    scope.effect(() => scope.webServer.register({ kind: "prefix", path: "/api/agent-desktop", handler: route }), "agent-desktop.http");
  });
  ctx.inject(["systemPrompt"], (scope) => scope.systemPrompt.section({ name: "agent-desktop", order: scope.systemPrompt.getSectionOrder("TOOL_COMPUTER_USE"), text: "desktop_* tools operate your session\u2019s independent host-native Linux display, not the user\u2019s physical desktop. Use desktop_start, desktop_screenshot, then desktop_action with the latest epoch; check results from a fresh screenshot. Reuse host-installed tools via desktop_launch. A paused or human-owned desktop must stay untouched until the human explicitly resumes it. No sandbox: files, network and GPU resources are shared. Never bypass control ownership with shell, another DISPLAY or raw input API. Stop only with explicit intent because unsaved applications close. GUI profiles/single-instance apps need care. Prefer atomic press (including modifiers) over raw key holds; Return/Enter down:true alone is not a complete keystroke. release clears only our held input. Use desktop_windows/focus to diagnose activation; do not blindly double-click or force grabs. Close-window only sends a confirmed WM_DELETE request and may show save dialogs. Model screenshots are fresh by default and include capture time, id, crop offsets and scale. desktop_probe samples raw composited desktop RGB, not source-file pixels or semantic correctness. Screenshots may include a small green virtual-pointer marker." }));
}
async function body(req) {
  if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new DesktopError("JSON content-type required", "bad-content-type", 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const data = Buffer.from(chunk);
    size += data.length;
    if (size > 65536) throw new DesktopError("Request body too large", "body-too-large", 413);
    chunks.push(data);
  }
  try {
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    if (error instanceof DesktopError) throw error;
    throw new DesktopError("Invalid JSON body", "bad-json", 400);
  }
}
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function createHandler(options) {
  return async (req, res) => {
    const rejection = options.reject(req);
    if (rejection !== void 0) {
      json(res, rejection, { error: "DSH authentication and same-origin access required", code: "unauthorized" });
      return;
    }
    const abort = new AbortController();
    const disconnect = () => {
      if (!res.writableEnded) abort.abort(new Error("Client disconnected"));
    };
    res.once("close", disconnect);
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = url.pathname.slice("/api/agent-desktop".length);
      const capability = typeof req.headers["x-desktop-control"] === "string" ? req.headers["x-desktop-control"] : void 0;
      if (route === "/style.css" && req.method === "GET") {
        res.writeHead(200, { "content-type": "text/css", "cache-control": "no-store" });
        res.end(await readFile2(options.stylePath));
        return;
      }
      if (route === "/status" && req.method === "GET") {
        const id = sessionId(url.searchParams.get("sessionId"));
        options.directory(id);
        const humanEpoch = url.searchParams.get("human") === "true" ? epoch(Number(url.searchParams.get("epoch"))) : void 0;
        options.broker.status(id, humanEpoch, capability);
        json(res, 200, await options.broker.inspect(id, abort.signal));
        return;
      }
      if (route === "/frame" && req.method === "GET") {
        const id = sessionId(url.searchParams.get("sessionId"));
        options.directory(id);
        const expected = epoch(Number(url.searchParams.get("epoch")));
        const frame = await options.broker.frame(id, expected, abort.signal);
        res.writeHead(200, { "content-type": "image/png", "content-length": frame.data.length, "cache-control": "no-store", "x-content-type-options": "nosniff" });
        res.end(frame.data);
        return;
      }
      if (route === "/control" && req.method === "POST") {
        const v = await body(req), id = sessionId(v.sessionId), cwd = options.directory(id), operation = controlAction(v.action);
        if (operation !== "start" && v.expectedEpoch === void 0) throw new DesktopError("Refresh status and supply expectedEpoch", "bad-epoch", 400);
        if (operation === "release" && options.broker.status(id).owner === "human") options.broker.assertHuman(id, epoch(v.expectedEpoch), capability);
        json(res, 200, await options.broker.control(id, operation, cwd, v.expectedEpoch === void 0 ? void 0 : epoch(v.expectedEpoch), abort.signal, operation === "start" ? desktopSize(v) : void 0));
        return;
      }
      if (route === "/input" && req.method === "POST") {
        const v = await body(req), id = sessionId(v.sessionId);
        options.directory(id);
        const current = options.broker.status(id);
        const status = await options.broker.input(id, "human", epoch(v.epoch), action(v.action, current.width, current.height), abort.signal, capability);
        json(res, 200, { ok: true, status });
        return;
      }
      json(res, 404, { error: "Unknown desktop endpoint", code: "not-found" });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error instanceof DesktopError ? error.httpStatus : 500, { error: error instanceof Error ? error.message : String(error), code: error instanceof DesktopError ? error.code : "desktop-error" });
    } finally {
      res.removeListener("close", disconnect);
    }
  };
}
export {
  Config,
  apply,
  createHandler,
  inject,
  name
};
