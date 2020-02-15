// 插值的正则Interpolation reg, 用来匹配插值
// []字符类，{匹配其中任意一个
// ^脱字符，[^{]匹配除了{以外的任意字符
// ()分组匹配，用来提取匹配到的子字符串（插值的内容，即data的key），reg.exec结果里的[1]项
// 如果想使用exec方法，使用的时候需要new RegExp，不然会受到之前的test等方法的影响，例如使用过一次test之后，下一次exec会从上一次匹配到之后的结果后一个index开始匹配
const interReg = /\{\{([^{}]+)\}\}/g;
// view解析
class Compile {
  /**
   * @param {DOM, String} el - 根节点或者根节点上的id，class等选择器
   * @param {object} vm - mvvm对象，通过vm实例获取model的值
   */
  constructor(el, vm) {
    this.$el = this.isElementNode(el) ? el : document.querySelector(el);
    this.$vm = vm;
    this.$frag = this.node2Fragment(this.$el);
    this.compile(this.$frag);
    this.$el.appendChild(this.$frag);
  }
  // ==========编译核心==========
  compile(el) {
    var childNodes = el.childNodes;
    Array.prototype.slice.call(childNodes).forEach((node) => {
      if (this.isElementNode(node)) {
        this.compileElement(node);
        this.compile(node); // 递归，编译元素内的子节点
      } else if (this.isTextNode(node)) {
        this.compileText(node);
      }
    })
  }
  // 编译元素节点，用于处理元素节点上的指令例如v-model等
  compileElement(node) {
    var attributes = node.attributes;
    // attr列表，列表的每一个元素是一个attr对象，包括name，value等key
    Array.prototype.slice.call(attributes).forEach((attr) => {
      if (this.isDirective(attr.name)) {
        var dir = attr.name.substring(2); // v-后面的指令名称
        var exp = attr.value;
        if (this.isBindDirective(dir)) {
          // 1. v-bind
          var index = dir.indexOf(':');
          var newAttr = dir.substring(index + 1); // v-bind:绑定的属性，例如v-bind:style => newAttr === style
          compileUtil.bind(node, this.$vm, exp, newAttr);
        } else if (this.isEventDirective(dir)) {
          // 2. v-on, 事件指令 
          var index = dir.indexOf(':');
          var eventType = dir.substring(index + 1); // 事件名称
          compileUtil.on(node, this.$vm, exp, eventType);
        } else {
          // 3. 其他v-指令
          compileUtil[dir](node, this.$vm, exp);
        }
        // 观察后移除显示的属性
        node.removeAttribute(attr.name);
      }
    });
  }
  // 编译文本节点，用于处理插值{{}}，因为元素会在compile方法内做递归处理，所以最后插值的内容一定会作为文本节点来处理
  compileText(node) {
    var textContent = node.textContent;
    if (new RegExp(interReg).test(textContent)) {
      compileUtil.text(node, this.$vm, textContent);
    }
  }
  // ==========编译核心==========

  // ==========功能函数==========
  // 是否是元素节点
  isElementNode(node) {
    return node.nodeType == 1;
  }
  // 是否是文本节点
  isTextNode(node) {
    return node.nodeType == 3;
  }
  // attr是否是v-指令
  isDirective(attr) {
    return attr.indexOf('v-') === 0;
  }
  // 是否是bind绑定指令
  isBindDirective(dir) {
    return dir.indexOf('bind:') === 0;
  }
  // 是否是事件监听器v-on
  isEventDirective(dir) {
    return dir.indexOf('on:') === 0;
  }
  // 因为遍历解析的过程有多次操作dom节点，为提高性能和效率
  // 将根节点的el转换成文档碎片fragment进行解析编译操作，解析完成，再将fragment添加回原来的真实dom节点中
  node2Fragment(el) {
    var fragment = document.createDocumentFragment();
    var child;
    // 将原生节点拷贝到fragment
    // appendChild相当于移动，每次firstChild被append到frag里面之后，就不存在在原始根节点中了
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }
    return fragment;
  }
}

// 编译处理集合，指令，插值等
compileUtil = {
  // =======插值处理，文本节点=======
  /**
   * @param {node} node - 文本节点
   * @param {object} vm - mvvm实例
   * @param {string} text - node中的原始textcontent，需要考虑多个插值的形式，例如{{ name.first }} {{ name.last }}
   */
  text(node, vm, text) {
    // 因为文本节点不能再拆分了，所以如果想要在存在多个插值的情况下进行数据绑定，需要把原始的文本，即text，作为闭包的形式传入到watcher中
    var updateFn = this.updater.text;
    // 首次加载，初始化view，没有响应式相关的操作，就是从model取值取代插值表达式
    updateFn && updateFn(node, this.getTextNodeVal(vm, text));
    // 初始化watcher，watcher初始化时，会调用model的getter方法，从而将自己添加到dep（观察者列表）中
    // 如果存在多个插值，对每个插值表达式都要创建一个watcher
    var reg = new RegExp(interReg);
    var matchRes = reg.exec(text);
    while (matchRes) {
      var exp = matchRes[1].trim();
      var self = this; // 因为watcher收到通知时会调用cb，cb内部要使用getTextNodeVal方法，通过闭包把this穿进去（或者cb用箭头函数）
      new Watcher(vm, exp, function() {
        // 原始的完整文本内容text以闭包的形式传进来，一直维护着
        updateFn && updateFn(node, self.getTextNodeVal(vm, text));
      });
      matchRes = reg.exec(text);
    }
  },
  // =======指令，v-*=======
  // 1. v-html
  html(node, vm, exp) {
    var updateFn = this.updater.html;
    // 初始化
    updateFn && updateFn(node, this.getModelVal(vm, exp));
    // 初始化watcher，原理和text一致
    new Watcher(vm, exp, () => {
      updateFn && updateFn(node, this.getModelVal(vm, exp));
    });
  },
  // 2. v-model，双向绑定
  model(node, vm, exp) {
    // node是input, textarea
    var updateFn = this.updater.model;
    // model -> view
    updateFn && updateFn(node, this.getModelVal(vm, exp));
    new Watcher(vm, exp, () => {
      updateFn && updateFn(node, this.getModelVal(vm, exp));
    });
    // view -> model
    var prevVal = this.getModelVal(vm, exp); 
    node.addEventListener('input', (e) => {
      var newVal = e.target.value;
      if (prevVal === newVal) return;
      this.setModelVal(vm, exp, newVal);
      prevVal = newVal;
    });
  },
  // 3. v-bind:attr
  bind(node, vm, exp, attr) {
    var updateFn = this.updater.bind;
    updateFn && updateFn(node, this.getModelVal(vm, exp), attr);
    new Watcher(vm, exp, () => {
      updateFn && updateFn(node, this.getModelVal(vm, exp), attr);
    });
  },
  // =======事件监听指令, v-on=======
  /**
   * @param {string} exp - 方法名称，可能存在有参数的情况例如alertInfo('this is info')或者alertInfo(message)，message是model中的值
   * @param {string} type - 事件名 
   */
  on(node, vm, exp, type) {
    var reg = /\((.*)\)/; // 如果有传参，匹配（）中内容用于提取参数
    var result = exp.match(reg);
    var fnArgs; // 实参列表
    var isModelData = []; // 实参是否是model的值，还是普通js数据类型
    if (result) {
      exp = exp.substring(0, result.index); // 方法名称，去掉后面的传参内容后
      fnArgs = result[1].split(','); // 实参
      fnArgs = fnArgs.map((item) => item.trim());
      fnArgs.forEach((arg) => {
        if (this.getModelVal(vm, arg)) {
          isModelData.push(true);
        } else {
          isModelData.push(false);
        };
      });
    }
    var fn = vm.$options.methods && vm.$options.methods[exp];
    if (type && fn) {
      node.addEventListener(type, () => {
        // 每次调用的时候，都要根据isModelData判断实参是不是model的值，如果是的话重新去获取model中的最新值
        var args = isModelData.map((isModel, index) => {
          if (isModel) {
            return this.getModelVal(vm, fnArgs[index]);
          }
          return new Function(`return ${fnArgs[index]}`)();
        });
        fn.apply(vm, args);
      });
    }
  },
  // =======公用方法=======
  // 将原始的完整文本内容，中的全部插值替换成最新的model的值，例如name: {{ name.first }} {{ name.last }}
  getTextNodeVal(vm, text) {
    var reg = new RegExp(interReg);
    return text.replace(reg, (...args) => {
      // args是正则的匹配结果，args[0]是正则匹配的完整子串，args[1], args[2]...是分组匹配的子串
      // 这里就是插值表达式{{}}内的内容，即model的key
      return this.getModelVal(vm, args[1].trim());
    });
  },
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
  },
  // 双向绑定时使用，通过view的交互，更新model的值
  setModelVal(vm, exp, val) {
    var expArr = exp.split('.');
    var curVal = vm;
    for (let i = 0; i < expArr.length; i += 1) {
      var key = expArr[i];
      if (!curVal) return curVal;
      if (i < expArr.length - 1) {
        curVal = curVal[key];
      } else {
        curVal[key] = val;
      }
    }
  },
  updater: {
    // 文本节点插值更新，例如把{{a}}替换成a的值
    text(node, val) {
      node.textContent = val;
    },
    // v-html指令
    html(node, val) {
      node.innerHTML = val;
    },
    // v-model
    model(node, val) {
      node.value = val;
    },
    // v-bind
    bind(node, val, attr) {
      node.setAttribute(attr, val);
    }
  }
}