# iReader

## 英语在线点读系统
一个在线点读系统，将资源和播放系统分开，外挂资源实现英语在线点读学习。

可以自己制作自己需要的学习资源，通过外挂资源的模式实现在线点读学习。

## 系统使用
系统地址：[https://tap.ichochy.com](https://tap.ichoqchy.com)

系统默认资源为：  
《译林英语》4A课程：[https://github.com/QiLoong/YL-English-Book](https://github.com/QiLoong/YL-English-Book)

通过`bookPath`参数外挂加载资源:  
外挂资源：[https://tap.ichochy.com?bookPath=https://yl.mleo.site/4A](https://tap.ichochy.com?bookPath=https://yl.mleo.site/4A)

## 外挂资源
资源内容参考：[https://github.com/QiLoong/YL-English-Book](https://github.com/QiLoong/YL-English-Book)

## 系统功能：
1. 单句点读，点击单句可以单句点读
2. 全文朗读，点击播放可以全文朗读
3. 速度调节，点击速度调节按钮调节朗读速度
4. 中英展示，界面中、英文同步展示
5. 课文切换，课文可以上、下课快速切换
6. 进度记录，保存学习课文记录，再此进入系统继续上次学习的课文
7. 外挂资源，通过参数bookPath，外挂加载自己的学习资源
8. 主题切换，明、暗主题随意切换

## 本地部署 Nginx

### 下载项目
下载地址：[https://github.com/iChochy/iReader/archive/refs/heads/main.zip](https://github.com/iChochy/iReader/archive/refs/heads/main.zip)  
下载并解压，放入用户目录，如：`/Users/iChochy/iReader`

### 安装Nginx

```bash
brew install nginx
```

### 修改配置文件
1. 运行 `nginx -h`
```bash
iChochy[home]:nginx -h
nginx version: nginx/1.29.3
-c filename   : set configuration file (default: /opt/homebrew/etc/nginx/nginx.conf)
```
`Nginx` 默认配置文件：`/opt/homebrew/etc/nginx/nginx.conf`

2. 修改配置文件：
```bash
    server {
        listen       80;
        server_name  localhost;

        #access_log  logs/host.access.log  main;

        location / {
            root   /Users/iChochy/iReader;
            index  index.html index.htm;
        }
```
将`root`参数指向项目的目录`/Users/iChochy/iReader`

### 运行Nginx
```bash
brew services start nginx
```

### 访问系统
本地地址：[http://localhost](http://localhost)   
浏览器访问地址，查看点读系统  

注: 监听端口: `listen 80`

## 系统截图
Mobile:  
![mobile](https://tap.ichochy.com/screenshot/mobile.png)

PC:  
![pc](https://tap.ichochy.com/screenshot/pc.png)