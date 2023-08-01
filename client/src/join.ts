import { io } from 'socket.io-client'
import { initializeGame } from './game'

export const socket = io()

const form = document.getElementById('form') as HTMLFormElement
const usernameField = document.getElementById('username-field') as HTMLInputElement
const joinButton = document.getElementById('join-button') as HTMLButtonElement

export function join() {
    socket.on('connect', () => {
        console.log('Connected to the server')

        /*joinButton.addEventListener('click', () => {
            initializeGame(usernameField.value)
        })*/

        form.style.display = 'none'
        initializeGame(names[Math.floor(Math.random() * names.length)])
    })
}

const names: string[] = [
    'david',
    'joe',
    'daniel',
    'michael',
    'harry'
]