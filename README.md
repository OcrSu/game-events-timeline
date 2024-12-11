<!-- # game-events-timeline -->
# 原铁绝潮 - 活动时间线

在浏览器中实时确认游戏的活动时间线，目前包括：原神、崩坏：星穹铁道、绝区零、鸣潮

数据来自于各个游戏的公告，每天定时更新

为什么是这四个游戏？因为这些游戏的运营模式都基本相同（即原神模式，自己取的名）

---


flask作为后端，前端纯原生实现，未使用框架

登录账号后，可实时同步活动的完成状态

暂时不做用户注册的功能，可自行在数据库中设定，首次运行服务端时，会在控制台输出默认用户名和初始密码

---

Docker Compose

~~~
services:
  mihomoget:
    image: suyiyi/getcheck:latest
    container_name: mihomoGET
    restart: always
    ports:
      - "8180:8180"
    environment:
      TZ: Asia/Shanghai
~~~
