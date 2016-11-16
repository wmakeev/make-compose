import mergeWith from 'lodash.mergewith';
import assign from 'lodash.assign';
import isFunction from 'lodash.isfunction';
import isObject from 'lodash.isobject';

const isDescriptor = isObject;
const isComposable = isObject;
const merge = (dst, src) => mergeWith(dst, src, (dstValue, srcValue) => {
  if (Array.isArray(dstValue)) {
    if (Array.isArray(srcValue)) return dstValue.concat(srcValue);
    if (isObject(srcValue)) return merge({}, srcValue);
  }
});

// Default implementations
const di = {
  isDescriptor: isDescriptor,

  isComposable: isComposable,

  assign: assign,

  merge: merge,

  createObject: Object.create,

  createFactory: function createFactory(descriptor) {
    const self = this;
    return function Stamp(options, ...args) {
      let obj = (self || di).createObject(descriptor.methods || {});

      (self || di).merge(obj, descriptor.deepProperties);
      (self || di).assign(obj, descriptor.properties);
      Object.defineProperties(obj, descriptor.propertyDescriptors || {});

      if (!descriptor.initializers || descriptor.initializers.length === 0) return obj;

      return descriptor.initializers.reduce((resultingObj, initializer) => {
        const returnedValue = initializer.call(resultingObj, options,
          {instance: resultingObj, stamp: Stamp, args: [options].concat(args)});
        return returnedValue === undefined ? resultingObj : returnedValue;
      }, obj);
    };
  },

  createStamp: function createStamp(descriptor, composeFunction) {
    const Stamp = (this || di).createFactory(descriptor);

    (this || di).merge(Stamp, descriptor.staticDeepProperties);
    (this || di).assign(Stamp, descriptor.staticProperties);
    Object.defineProperties(Stamp, descriptor.staticPropertyDescriptors || {});

    const composeImplementation = isFunction(Stamp.compose) ? Stamp.compose : composeFunction;
    Stamp.compose = function () {
      return composeImplementation.apply(this, arguments);
    };
    (this || di).assign(Stamp.compose, descriptor);

    return Stamp;
  },

  mergeComposable: function mergeComposable(dstDescriptor, srcComposable) {
    const srcDescriptor = (srcComposable && srcComposable.compose) || srcComposable;
    if (!(this || di).isDescriptor(srcDescriptor)) return dstDescriptor;

    const combineProperty = (propName, action) => {
      if (!isObject(srcDescriptor[propName])) return;
      if (!isObject(dstDescriptor[propName])) dstDescriptor[propName] = {};
      action(dstDescriptor[propName], srcDescriptor[propName]);
    };

    combineProperty('methods', (this || di).assign);
    combineProperty('properties', (this || di).assign);
    combineProperty('deepProperties', (this || di).merge);
    combineProperty('propertyDescriptors', (this || di).assign);
    combineProperty('staticProperties', (this || di).assign);
    combineProperty('staticDeepProperties', (this || di).merge);
    combineProperty('staticPropertyDescriptors', (this || di).assign);
    combineProperty('configuration', (this || di).assign);
    combineProperty('deepConfiguration', (this || di).merge);
    if (Array.isArray(srcDescriptor.initializers)) {
      if (!Array.isArray(dstDescriptor.initializers)) dstDescriptor.initializers = [];
      dstDescriptor.initializers.push.apply(dstDescriptor.initializers, srcDescriptor.initializers.filter(isFunction));
    }

    return dstDescriptor;
  }
};

module.exports = assign(function (options) {
  const impl = assign({}, di, options);
  return function compose(...composables) {
    const descriptor = [this].concat(composables).filter(impl.isComposable).reduce(impl.mergeComposable.bind(impl), {});
    return impl.createStamp(descriptor, compose);
  };
}, di);
