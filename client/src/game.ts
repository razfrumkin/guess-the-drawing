import p5 from 'p5'
import { socket } from './join'

const container = document.getElementById('container') as HTMLDivElement
const chat = document.getElementById('chat') as HTMLDivElement

type Settings = { canvasWidth: number, canvasHeight: number }
type UserCollection = { [id: string]: string }

let settings: Settings
let users: UserCollection

export function initializeGame(username: string) {
    users = {}

    socket.emit('joined', username)
    activateSocketEvents()
}

function activateSocketEvents() {
    socket.on('user-joined', (id: string, username: string) => {
        const span = document.createElement('span')
        span.textContent = `${username} has joined`
        span.style.color = 'green'
        chatLog(span)

        if (socket.id === id) return
        users[id] = username
    })

    socket.on('user-left', (id: string) => {
        const span = document.createElement('span')
        span.textContent = `${users[id]} has left`
        span.style.color = 'red'
        chatLog(span)

        delete users[id]
    })

    socket.on('welcome', (gameSettings: Settings, allUsers: UserCollection) => {
        settings = gameSettings
        users = allUsers

        new p5(activateSketch)
    })
}

function activateSketch(sketch: p5) {
    sketch.setup = () => {
        const renderer = sketch.createCanvas(settings.canvasWidth, settings.canvasHeight)
        container.insertAdjacentElement('afterbegin', renderer.elt)
        sketch.frameRate(60)
    }

    sketch.draw = () => {
        input(sketch)
        render(sketch)
    }
}

function chatLog(span: HTMLSpanElement) {
    chat.insertBefore(document.createElement('br'), chat.firstChild)
    chat.insertBefore(span, chat.firstChild)
    const time = document.createElement('span')
    time.textContent = `${hoursMinutesSeconds()}: `
    time.style.color = 'black'
    chat.insertBefore(time, chat.firstChild)
}

function hoursMinutesSeconds(): string {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

function input(sketch: p5) {

}

function render(sketch: p5) {
    sketch.background(50)
    sketch.fill(200)
    sketch.textAlign('left')
    let y = 50
    for (const id in users) {
        y += 50
        sketch.textSize(32)
        sketch.text(users[id], 50, y)
    }
}