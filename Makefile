.PHONY: build watch

build:
	node_modules/.bin/buble singing-keyboard.js > singing-keyboard.build.js

watch:
	node_modules/.bin/nodemon -w singing-keyboard.js -x 'make build || exit 1'
