export function getTime() {
    return new Date().toLocaleTimeString('en', { hour12: false })
}