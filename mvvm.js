class MVVM {
  constructor(options) {
    this.$options = options;
    var data = this._data = this.$options.data;
    var methods = this._methods = this.$options.methods;
    // 属性代理
    Object.keys(data).forEach((key) => {
      this._proxy(key);
    });
    // 方法代理
    Object.keys(methods).forEach((key) => {
      this._proxyMethods(key);
    });
    observe(data); // 观察数据对象
    this.$compile = new Compile(this.$options.el, this); // 编译
  }
  // 通过defineProperty进行属性代理，在this（vm实例）上加上data model的各个key
  _proxy(key) {
    Object.defineProperty(this, key, {
      configurable: false,
      enumerable: true,
      get() {
        return this._data[key];
      },
      set(val) {
        this._data[key] = val;
      }
    })
  }
  // 方法代理
  _proxyMethods(key) {
    Object.defineProperty(this, key, {
      configurable: false,
      enumerable: true,
      get() {
        return this._methods[key];
      }
    })
  }
}