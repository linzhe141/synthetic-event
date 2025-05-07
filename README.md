## 手写一个简易版 React 合成事件系统

在这篇笔记中，我将实现一个迷你版的 React 合成事件机制，并通过代码例子来理解 React 的事件系统核心原理。我们的目标不是完全复刻 React，而是学习它背后的设计思想。

### 什么是合成事件？

React 并不是直接将事件绑定在 DOM 元素上，而是采用了“事件委托 + 自定义事件系统”的方式：

- 所有事件统一绑定到根节点（如 `document` 或 React Root）；
- 自己模拟 DOM 的事件捕获 & 冒泡流程；
- 封装事件对象，统一 API，支持跨浏览器行为；
- 可控制事件传播、批处理更新等。

### 实现步骤

我们通过以下几个步骤构建一个最小可用的合成事件系统：

#### 1. 使用 `h` 函数创建虚拟 DOM 元素

```jsx
/** @jsx h */
const elements = (
  <div
    onClick={() => console.log('parent onClick')}
    onClickCapture={() => console.log('parent onClickCapture')}
  >
    <div
      onClick={(e) => {
        e.stopPropagation()
        console.log('111 onClick')
      }}
      onClickCapture={(e) => {
        console.log('111 onClickCapture')
      }}
    >
      111
    </div>
    <div
      onClick={() => console.log('222 onClick')}
      onClickCapture={() => console.log('222 onClickCapture')}
    >
      222
    </div>
  </div>
)
```

这个需要babel进行定制化编译

```js
import babel from '@rollup/plugin-babel'

export default defineConfig({
  plugins: [
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.jsx'],
      include: ['./**/*'],
      presets: [['@babel/preset-react', { pragma: 'h' }]],
    }),
  ],
})
```

这就是我们自己的h函数，用于创建element（也叫虚拟dom）

```js
export function h(type, props, ...children) {
  return {
    type,
    props,
    children: children.length > 1 ? children : children[0],
  }
}
```

这段代码创建了一个虚拟 DOM 树，并挂载到我们自定义的 `createRoot` 中。

#### 2. 渲染虚拟 DOM 到真实 DOM

我们通过递归方式生成真实 DOM，并将每个虚拟节点存在 `.element` 属性上，用于后续事件系统定位。

```js
function creatDomElement(element) {
  const { type, props, children } = element
  const dom = document.createElement(type)
  dom.element = element
  if (Array.isArray(children)) {
    for (const child of children) {
      const childDom = creatDomElement(child)
      dom.appendChild(childDom)
    }
  } else {
    dom.textContent = children
  }
  return dom
}
```

#### 3. 构造事件路径：通过 `.parent` 模拟 Fiber 树

为了模拟事件冒泡/捕获路径，我们在渲染前递归标记每个节点的 `.parent` 属性：

```js
function formatElement(element, parent = null) {
  element.parent = parent
  if (Array.isArray(element.children)) {
    for (const child of element.children) {
      formatElement(child, element)
    }
  }
}
```

#### 4. 事件监听与分发：模拟捕获 & 冒泡阶段

事件只在根节点绑定一次：

```js
rootDom.addEventListener('click', wrapCaptureListener, true) // 捕获
rootDom.addEventListener('click', wrapBubbleListenerListener) // 冒泡
```

然后我们手动从 `event.target.element` 向上找父节点，构造监听器列表：

```js
function captureListener(nativeEventName, nativeEvent) {
  let current = nativeEvent.target.element
  while (current) {
    // 查找 onClickCapture
    current = current.parent
  }
}
```

并在合适阶段执行监听器：

```js
for (let i = listeners.length - 1; i >= 0; i--) {
  if (_event.propagationStopped) return
  listener(_event)
}
```

#### 5. 合成事件对象封装

我们实现了一个类 `SyntheticEvent`，统一了 `stopPropagation` 和 `preventDefault` 的调用：

```js
class SyntheticEvent {
  nativeEvent = null
  defaultPrevented = false
  propagationStopped = false
  constructor(nativeEvent) {
    this.nativeEvent = nativeEvent
  }
  preventDefault() {
    this.defaultPrevented = true
    this.nativeEvent.preventDefault()
  }
  stopPropagation() {
    this.propagationStopped = true
    this.nativeEvent.stopPropagation()
  }
}
```
