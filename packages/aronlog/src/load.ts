// import { getText } from './utils/get-text'
// import { spinnerFrames } from './utils/spinner-frames'
// import cliCursor from 'cli-cursor'

// const load = (event: string, message?: string, options?: any) => {
//     if (event && !message) {
//         message = event
//         event = ''
//     }
//     // const loading =
//     //     loading.log = (event: string, message?: string) => {
//     //         loading.clear()
//     //         loading.text = getText(event, message)
//     //         return loading
//     //     }
//     // eslint-disable-next-line @typescript-eslint/no-empty-function
//     const loading = function () {

//     }

//     let timer

//     loading.start = () => {
//         if (timer) {
//             loading.end()
//         }
//         let frameIndex = 0
//         timer = setInterval(() => {
//             process.stdout.moveCursor(0, -1)
//             process.stdout.clearLine(1)
//             process.stdout.write(`${spinnerFrames[frameIndex]}\n`)
//             cliCursor.hide()
//             frameIndex += 1
//             if (frameIndex === spinnerFrames.length) {
//                 frameIndex = 0
//             }
//         }, 100)
//         return loading
//     }

//     loading.end = () => {
//         clearInterval(timer)
//         timer = null
//         cliCursor.show()
//         return loading
//     }

//     process.on('exit', (code) => {
//         loading.end()
//     })

//     return loading.start()
// }

// export { load }