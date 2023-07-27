import { io } from 'socket.io-client'
import { Game } from './game'

const socket = io()

const usernameField = document.getElementById('username-field') as HTMLInputElement
const joinButton = document.getElementById('join-button') as HTMLButtonElement

export function join() {
    socket.on('connect', () => {
        console.log('Connected to the server')
    })

    joinButton.addEventListener('click', () => {
        new Game(socket, usernameField.value)
    })
}