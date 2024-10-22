# PlayDay.ai

PlayDay.ai is a visual tool for rapid prototyping of AI experiences. 

Try the demo at [https://playday.ai](https://playday.ai)

#### Example: Autonomous agent inspired by "Nano AGI"
- A user types an objective
- The system generates the next list of tasks to complete the objective
- The system runs all the tasks in parallel
- The system continues working until it believes the objective is completed
 
<img src="https://playday.ai/nanoagi_view.png" alt="PlayDay.ai Nano AGI Screenshot" width="600"/>

#### Example: Section of an interactive game
- Text is converted to speech
- A scenario may be added at random
- NPN (non-playable character) actions are decided
- NPC speech is decided (not shown: it's later played as audio)
- A random sound effect is played

<img src="https://playday.ai/game_view.png" alt="PlayDay.ai Interactive Game Screenshot" width="600"/>

## Core Features

- Visual designer for integrating AI services
- Support for popular AI services such as OpenAI, Anthropic, Google, ElevenLabs, and StableDiffusion
- Chaining AI outputs from multiple providers and media types
  - Example: use LLM output to generate an image
  - Example: transcribe microphone input to text to submit to an LLM
  - Example: enable ChatGPT and Claude to debate each other
- Multiple input types (text, voice, files)
- Rapid iteration with side-by-side view of editor and app
- Access control via "sharing" UI
- Choose whether users provide their own AI keys
- Ability to skin your app with colors and fonts


## Advanced Features

- Out-of-the-box support for deploying to servers (using Docker)
- Open-source model for adding new AI services

## Installation

```bash
# Clone the repository
git clone https://github.com/tomlangan/playday

# Install the packages
npm install

# Copy the settings template
cp .env.TEMPLATE .env
```

Then, edit the `.env` file with your settings. The Quick Start guides below provide examples.

## Quick Start: Running locally (Docker)

### Prerequisites

1. Install Docker (platform dependent install methods)

The default `.env` will work without modifications, just run the install script:

```bash
chmod +x ./deploy_docker.sh
./deploy_docker.sh
```

Access the tool at http://localhost:3000

[Windows only] If you don't have WSL2 and can't run the script above, run docker compose from powershell instead:

```powershell
docker compose up rabbitmq mongodb taskserver frontend --build -d
```

## Quick Start: Running locally for development

### Prerequisites

1. Run the "Docker" quickstart above, which provisions the MongoDB and RabbitMQ servers you need
(If you want to use your own instances of MongoDB or RabbitMQ, see "Advanced" section below)

Update the `.env` file replacing the host names with "localhost":
```env
## Configure the MONGODB_URL
MONGODB_URL='mongodb://playday:asdf1234@localhost:27017/?tls=false&directConnection=true'

## Configure the RABBITMQ_URL
RABBITMQ_URL='amqp://playday:asdf1234@localhost:5672?heartbeat=60'
```

Shut down the PlayDay.ai server docker containers:


```bash
docker compose down frontend
docker compose down taskserver
```

### Mac / Linux

Run the servers:

```bash
# Open a command prompt and run this command to launch the front-end server
npm run dev

# Open a second command prompt to run the back-end app platform
npm run taskserver
```

### Windows

Run the servers (powershell):

```powershell
# Open a command prompt and run this command to launch the front-end server
npm run windev

# Open a second command prompt to run the back-end app platform
npm run winserver
```

Access the tool via http://localhost:3000

## Advanced

### Using your own RabbitMQ server

1. Update the connection string in your .env file to connect to your RabbitMQ instance, ensuring that the account has rights to create all the necessary routes.

### Using your own MongoDB server

1. Use mongorestore to populate the databases and collections you need. The files can be found in mongodb\dump

2. Update the connection string in your .env file to the connection string for your MongoDB server

### Deploying a production a server (with SSL)

1. Create an Auth0 account and configure a "Regular Web Application" for PlayDay.ai
2. Install Docker (platform dependent install methods)
3. Acquire a domain name for your site

Configure the `.env` by uncommenting the "PRODUCTION" section and filling it out.

Make the following edits to the `.env` configuration:

```ini
## Configure OPTIONAL_SERVICES to include nginx and certbot
OPTIONAL_SERVICES="nginx rabbitmq certbot mongo"

## Change the protocol to HTTPS
protocol='HTTPS'

## Turn off SANDBOX mode by commenting out this line:
# SANDBOX=true

## Uncomment the HTTPS port and ensure it's set to 443
EXTERNAL_HTTPS_PORT=443

## Change the base URL to your domain 
BASE_URL='yourdomain.com'

## Admin of your PlayDay.ai instance, which will take effect on first sign-in via Auth0.
AUTH_ADMIN_ACCOUNT=youraccount@somedomain.com

## Email address for the SSL certificate. This is used to verify the domain.
SSL_CERT_EMAIL=youraccount@somedomain.com

## Configure the AUTH0 section 
AUTH0_BASE_URL=...
AUTH0_ISSUER_BASE_URL=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=...
AUTH0_SECRET=...

## If you have your own MongoDB or RabbitMQ servers, you can modify the connection strings and remove
## them from the OPTIONAL_SERVICES list.
```

Deploy the docker images for the service:

```bash
chmod +x ./deploy_docker.sh
./deploy_docker.sh
```

If you plan to use letsencrypt (see https://letsencrypt.org/) for SSL continue these instructions, otherwise configure your own SSL provider based on the instructions they provide.

Configure your domain with an A RECORD pointing to your server's IP address and a CNAME pointing to "www".

Run the Letsencrypt script in "test" mode to ensure it's working properly. The production version has a rate limit on the number of certificates that can be produced per domain.

```bash
chmod +x ./init_letsencrypt.sh
./init_letsencrypt.sh test
```

If the script ran cleanly (producing "staging" certificates for your site), run the production version of the command to get the (final) production SSL certificats:

```bash
./deploy_docker.sh production
```

Access the tool at `https://yourdomain.com`
