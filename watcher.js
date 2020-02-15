// Watcher在实例化的时候要能够把自己添加进观察的subject对象的dep中
// 每个watcher都是在观察一个model的值（初始化时的exp表达式对应的值）
class Watcher {
  /**
   * @param {object} vm - mvvm实例对象 
   * @param {string} exp - 表达式，例如name: { last: 'jack' } -> name.last
   * @param {fn} cb - callback 
   */
  constructor(vm, exp, cb) {
    this.$vm = vm;
    this.$exp = exp;
    this.$cb = cb;
    this.get();
  }
  get() {
    Dep.target = this;
    // 在实例化watcher时，会调用数据的get方法，get方法内会把当前的Dep.target（即当前的watcher）添加到dep中
    // 所以如果exp是一个嵌套的值，例如name.last，name的getter和name.last的getter都会被调用，所以name的dep中也会被加上一个$exp是name.last的watcher
    var value = this.getModelVal(this.$vm, this.$exp);
    Dep.target = null;
    return value;
  }
  // 从model中根据表达式获取数据
  getModelVal(vm, exp) {
    // 存在例如name.last这样嵌套的model值
    var expArr = exp.split('.');
    var curVal = vm;
    for (let i = 0; i < expArr.length; i += 1) {
      if (!curVal) return curVal;
      curVal = curVal[expArr[i]];
    }
    return curVal;
  }
  update() {
    console.log('Watcher收到了通知');
    var newVal = this.getModelVal(this.$vm, this.$exp);
    this.$cb(newVal);
  }
}