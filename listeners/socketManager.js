let io;

const initializeSocket = (socketIO) => {
    io = socketIO;
    io.on('connection', async (socket) => {
        if (socket.user) {
            switch (socket.user.role) {
                case 'admin':
                    socket.join('admins')
                    break
                case 'director':
                    socket.join(`directors-${socket.user.restaurant}`)
                    break
                case 'waiter':
                    socket.join(`waiters-${socket.user.restaurant}`)
                    socket.join(`${socket.user._id}`)
                    console.log(socket.user)
                    break
                default:
                    break
            }
        }

        if (socket.restaurant && socket.table) {
            socket.join(`restaurant-${socket.restaurant}`)
            socket.join(`table-${socket.table}`)
        }

        socket.on('disconnect', () => {
            console.log('User disconnected')
        })
    })
}

const emitEventTo = (to, event, data) => {
    io.to(to).emit(event, data)
}

const emitEvent = (event, data) => {
    io.emit(event, data)
}

module.exports = {
    initializeSocket,
    emitEventTo,
    emitEvent
}