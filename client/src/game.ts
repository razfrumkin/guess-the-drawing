import p5 from 'p5'
import { socket } from './join'

const container = document.getElementById('container') as HTMLDivElement
const resetButton = document.getElementById('reset-button') as HTMLButtonElement

const redSlider = document.getElementById('red-slider') as HTMLInputElement
const greenSlider = document.getElementById('green-slider') as HTMLInputElement
const blueSlider = document.getElementById('blue-slider') as HTMLInputElement

const redSpan = document.getElementById('red-span') as HTMLSpanElement
const greenSpan = document.getElementById('green-span') as HTMLSpanElement
const blueSpan = document.getElementById('blue-span') as HTMLSpanElement

const undoButton = document.getElementById('undo-button') as HTMLButtonElement
const weightSlider = document.getElementById('weight-slider') as HTMLInputElement
const weightSpan = document.getElementById('weight-span') as HTMLSpanElement
const fillCheckbox = document.getElementById('fill-checkbox') as HTMLInputElement
const chat = document.getElementById('chat') as HTMLDivElement

type Settings = {
    canvasWidth: number
    canvasHeight: number 
    weightSliderMinimum: number
    weightSliderMaximum: number
    weightSliderDefault: number
}

type UserCollection = { [id: string]: string }

type Vector2D = { x: number, y: number }
type RGB = { red: number, green: number, blue: number }
type DrawingInstruction = {
    path: Vector2D[]
    color: RGB
    weight: number
}

let settings: Settings

let users: UserCollection

let drawingInstructions: DrawingInstruction[] = []
let path: Vector2D[] = []

export function initializeGame(username: string) {
    users = {}

    socket.emit('joined', username)
    
    socket.on('user-joined', (id: string, username: string) => {
        const span = document.createElement('span')
        span.textContent = `${username} has joined`
        span.style.color = 'white'
        chatLog(span)

        if (socket.id === id) return
        users[id] = username
    })

    socket.on('user-left', (id: string) => {
        const span = document.createElement('span')
        span.textContent = `${users[id]} has left`
        span.style.color = 'white'
        chatLog(span)

        delete users[id]
    })

    socket.on('welcome', (gameSettings: Settings, allUsers: UserCollection, instructions: DrawingInstruction[]) => {
        settings = gameSettings
        users = allUsers
        drawingInstructions = instructions

        new p5(activateSketch)
    })
}

function activateSketch(sketch: p5) {
    sketch.setup = () => {
        setup(sketch)
    }

    sketch.mouseDragged = () => {
        
    }

    sketch.draw = () => {
        input(sketch)
    }

    socket.on('new-path', (position: Vector2D, color: RGB, weight: number) => {
        const instruction = {
            path: [position],
            color: color,
            weight: weight
        }

        sketch.stroke(color.red, color.green, color.blue)
        sketch.strokeWeight(weight)
        sketch.point(position.x, position.y)

        drawingInstructions.push(instruction)
    })

    socket.on('drawing-position', (position: Vector2D) => {
        const instruction = drawingInstructions[drawingInstructions.length - 1]
        const previousPosition = instruction.path[instruction.path.length - 1]
        sketch.line(previousPosition.x, previousPosition.y, position.x, position.y)

        instruction.path.push(position)
    })

    socket.on('reset', () => {
        drawingInstructions = []

        sketch.background(255, 255, 255)
    })

    socket.on('undo', () => {
        drawingInstructions.pop()

        redrawAll(sketch)
    })
}

function redrawAll(sketch: p5) {
    sketch.background(255, 255, 255)

    for (let index = 0; index < drawingInstructions.length; index += 1) {
        executeInstruction(sketch, drawingInstructions[index])
    }
}

function chatLog(span: HTMLSpanElement) {
    chat.insertBefore(document.createElement('br'), chat.firstChild)
    chat.insertBefore(span, chat.firstChild)
    const time = document.createElement('span')
    time.textContent = `${hoursMinutesSeconds()}: `
    time.style.color = 'white'
    chat.insertBefore(time, chat.firstChild)
}

function hoursMinutesSeconds(): string {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

function setup(sketch: p5) {
    const renderer = sketch.createCanvas(settings.canvasWidth, settings.canvasHeight)
    container.insertAdjacentElement('afterbegin', renderer.elt)
    sketch.frameRate(60)

    redrawAll(sketch)

    resetButton.addEventListener('click', () => {
        drawingInstructions = []

        sketch.background(255, 255, 255)

        socket.emit('reset')
    })

    undoButton.addEventListener('click', () => {
        if (drawingInstructions.length === 0) return
        drawingInstructions.pop()

        redrawAll(sketch)

        socket.emit('undo')
    })

    redSlider.addEventListener('change', () => {
        redSpan.textContent = redSlider.value
    })

    greenSlider.addEventListener('change', () => {
        greenSpan.textContent = greenSlider.value
    })
    
    blueSlider.addEventListener('change', () => {
        blueSpan.textContent = blueSlider.value
    })

    weightSlider.min = settings.weightSliderMinimum.toString()
    weightSlider.max = settings.weightSliderMaximum.toString()
    weightSlider.value = settings.weightSliderDefault.toString()
    weightSpan.textContent = weightSlider.value

    weightSlider.addEventListener('input', () => {
        weightSpan.textContent = weightSlider.value
    })
}

function input(sketch: p5) {
    if (sketch.mouseIsPressed) {
        if (sketch.mouseButton === sketch.LEFT) {
            const mouse = { x: sketch.mouseX, y: sketch.mouseY }
            const color = getInputColor()

            if (!isInsideCanvas(mouse)) return

            if (fillCheckbox.checked) {
                floodFill(sketch, mouse)

                return
            }

            if (path.length === 0) {
                const weight = parseFloat(weightSlider.value)

                sketch.stroke(color.red, color.green, color.blue)
                sketch.strokeWeight(weight)
                sketch.point(mouse.x, mouse.y)

                path.push(mouse)

                socket.emit('new-path', mouse, color, weight)
            } else {
                const previousPosition = path[path.length - 1]
                sketch.line(previousPosition.x, previousPosition.y, mouse.x, mouse.y)

                path.push(mouse)

                socket.emit('drawing-position', mouse)
            }
        }
    } else {
        if (path.length > 0) {
            const instruction = {
                path: path,
                color: getInputColor(),
                weight: parseFloat(weightSlider.value)
            }

            drawingInstructions.push(instruction)

            path = []
        }
    }
}

function floodFill(sketch: p5, mouse: Vector2D) {
    sketch.loadPixels()



    sketch.updatePixels()
}

function executeInstruction(sketch: p5, instruction: DrawingInstruction) {
    sketch.noFill()
    sketch.stroke(instruction.color.red, instruction.color.green, instruction.color.blue)
    sketch.strokeWeight(instruction.weight)
    if (instruction.path.length === 1) {
        const position = instruction.path[0]
        sketch.point(position.x, position.y)
    } else {
        sketch.beginShape()
        for (let index = 0; index < instruction.path.length; index += 1) {
            const position = instruction.path[index]
            sketch.vertex(position.x, position.y)
        }
        sketch.endShape()
    }
}

function isInsideCanvas(position: Vector2D): boolean {
    return position.x >= 0 &&
           position.x < settings.canvasWidth &&
           position.y >= 0 &&
           position.y < settings.canvasHeight
}

function getInputColor(): RGB {
    return {
        red: parseFloat(redSlider.value),
        green: parseFloat(greenSlider.value),
        blue: parseFloat(blueSlider.value),
    }
}