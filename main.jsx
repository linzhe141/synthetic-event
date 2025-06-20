import { h, createRoot } from './src'

// vite默认支持 babel 的 /** @jsx h123 */ 规则，可能就是esbuid

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

const root = createRoot(document.getElementById('root'))
root.render(elements)

// 辅助方法
const oLog = console.log
Object.assign(console, {
  log(...args) {
    oLog(...args)
    const logWrapper = document.getElementById('log-wrapper')
    logWrapper.innerHTML += args.join(',') + '<br/>'
  },
})
const btn = document.getElementById('btn')
btn.addEventListener('click', () => {
  const logWrapper = document.getElementById('log-wrapper')
  logWrapper.innerHTML = ''
})

const codeDisplay = document.getElementById('code-display')
function escapeHTML(strings) {
  const raw = strings[0]

  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
codeDisplay.innerHTML = escapeHTML`
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
const root = createRoot(document.getElementById('root'))
root.render(elements)
`
