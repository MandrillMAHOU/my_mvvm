function observe(data) {
	if (!data || typeof data !== 'object') {
		return;
	}
	// 取出所有属性遍历
	Object.keys(data).forEach(function (key) {
		defineReactive(data, key, data[key]);
	});
};

function defineReactive(data, key, val) {
  observe(val); // 监听子属性
  var dep = new Dep(); // 对于每一个属性，都维护一个它的订阅者的列表
	Object.defineProperty(data, key, {
		enumerable: true, // 可枚举
		configurable: false, // 不能再define
		get: function () {
      Dep.target && dep.addSub(Dep.target); // watcher被实例化时调用
			return val; // val作为参数传进来的时候其实就存在一个闭包，相当于在函数第一行有var val = val;
		},
		set: function (newVal) {
			if (newVal === val) return;
			console.log('Model监听到值的变化 ', val, ' --> ', newVal);
      val = newVal;
      observe(val); // 赋值之后需要重新observe值，这样如果新的值是对象的化，它的子属性能够被继续监听
      dep.notify();
		}
	});
}

// 订阅者的列表
class Dep {
  constructor() {
    this.subs = [];
  }
  addSub(sub) {
    this.subs.push(sub);
  }
  notify() {
    this.subs.forEach(function (sub) {
			sub.update();
		});
  }
}