php for bakcend (optional)
typescript for frontend

website:
    - single page application (user can use browser back and forward arrow)
    - compatible with the latest stable up-to-date Mozilla firefox and other browsers
    - The user should encounter no unhandled errors or warnings when browsing the website
    - must use Docker to run your website. Everything must be launched with a single command line to run an autonomous container

server-side pong game:
    - player vs player on the same keyboard
    - tournament mode with matchmaking system

user managment system:
    - on tournament mode player can input aliases

security:
    - password stored in db must be hashed
    - protection against sql injection / xss attacks
    - enable https for every communication
    - implement validation mechanism both at user input level and backend level
    - secure the site at all costs (jwt, 2fa, secure api, strong password hashing algorithm, .env file)