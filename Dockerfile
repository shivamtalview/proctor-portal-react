FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ENV VITE_SUPABASE_URL=https://vukijbppuchsmwoyrbjt.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1a2lqYnBwdWNoc213b3lyYmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MzczMDIsImV4cCI6MjA4ODUxMzMwMn0.UUoinsD96wgHhkvBlZ2-p93CFkj-4TiPFBqPjrWahSI

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
