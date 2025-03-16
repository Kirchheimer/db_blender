FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create input and export directories
RUN mkdir -p /input /export

# Create symbolic links to input and export directories
RUN ln -s /input input && ln -s /export export

VOLUME ["/input", "/export"]

# Command to run the application
CMD ["npm", "start"]
