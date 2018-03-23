---
layout: post
title: dubbo-动态代理实现
date: 2018/03/22
tags: [tech, index, dubbo]
tag: [[java, java], [dubbo, dubbo]]
---

##### 　　动态代理对于dubbo来说不是必须的，没有代理实现，dubbo一样可以运行。但是dubbo的一个重要的特点就是调用远程服务就像调用本地服务一样的方便。这其中对于其调用过程的隐藏就是通过动态代理来实现的。动态代理本身就就不详细介绍了，可以参考之前的一篇文章：[java动态代理实现](https://winx402.github.io/note/javaDynamicProxy/)

<!--more-->

### 扩展接口：
##### `com.alibaba.dubbo.rpc.ProxyFactory`

### 使用配置:
```xml
<dubbo:consumer proxy="" />
<dubbo:provider proxy="" />
```

### 目前已知扩展：
* stub=com.alibaba.dubbo.rpc.proxy.wrapper.StubProxyFactoryWrapper
* jdk=com.alibaba.dubbo.rpc.proxy.jdk.JdkProxyFactory
* javassist=com.alibaba.dubbo.rpc.proxy.javassist.JavassistProxyFactory

### 包结构：
![](/img/note/dubbo/dubbo1.png)

### ProxyFactory
```java
@SPI("javassist") //默认使用javassist
public interface ProxyFactory {

    /**
     * 通过Invoker创建代理
     *
     * @param invoker dubbo的可执行单元
     * @return proxy java代理对象
     */
    @Adaptive({Constants.PROXY_KEY})
    <T> T getProxy(Invoker<T> invoker) throws RpcException;

    /**
     * 创建 invoker.
     *
     * @param <T>
     * @param proxy
     * @param type
     * @param url
     * @return invoker
     */
    @Adaptive({Constants.PROXY_KEY})
    <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) throws RpcException;
}
```

### AbstractProxyFactory
##### **AbstractProxyFactory**实现了之前的**ProxyFactory**接口以及其方法getProxy的通用实现
```java
public abstract class AbstractProxyFactory implements ProxyFactory {

    public <T> T getProxy(Invoker<T> invoker) throws RpcException {
        Class<?>[] interfaces = null;
        String config = invoker.getUrl().getParameter("interfaces");
        if (config != null && config.length() > 0) {
            String[] types = Constants.COMMA_SPLIT_PATTERN.split(config);
            if (types != null && types.length > 0) {
                interfaces = new Class<?>[types.length + 2];
                interfaces[0] = invoker.getInterface();
                interfaces[1] = EchoService.class;
                for (int i = 0; i < types.length; i++) {
                    interfaces[i + 1] = ReflectUtils.forName(types[i]);
                }
            }
        }
        if (interfaces == null) {
            interfaces = new Class<?>[]{invoker.getInterface(), EchoService.class};
        }
        return getProxy(invoker, interfaces);
    }

    public abstract <T> T getProxy(Invoker<T> invoker, Class<?>[] types);
}
```
##### getProxy方法主要是将该代理需要实现的接口给确定好，该接口存储在invoker对象的url的interfaces参数中，是一个字符串，用逗号分隔，我们不需要关心interfaces中存储的到底是哪些接口，只需要知道的是，invoker.getInterface()和EchoService.class会加入到其中，而另一个重载的getProxy方法显然是丢给子类来实现了。

## jdk实现方式
```java
/**
 * JdkProxyFactory
 * 继承了AbstractProxyFactory
 */
public class JdkProxyFactory extends AbstractProxyFactory {

    @SuppressWarnings("unchecked")
    public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.newProxyInstance(Thread.currentThread().getContextClassLoader(), interfaces, new InvokerInvocationHandler(invoker));
    }

    public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                Method method = proxy.getClass().getMethod(methodName, parameterTypes);
                return method.invoke(proxy, arguments);
            }
        };
    }

}
```

##### JdkProxyFactory继承了AbstractProxyFactory，并实现了其抽象方法

### getProxy
```java
public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.newProxyInstance(Thread.currentThread().getContextClassLoader(), interfaces, new InvokerInvocationHandler(invoker));
    }
```
##### 对，这里直接使用了jdk的Proxy类来创建代理对象。这里的关键在于InvokerInvocationHandler的实现：
```java
public class InvokerInvocationHandler implements InvocationHandler {

    private final Invoker<?> invoker; //实际执行对象

    //通过Invoker初始化
    public InvokerInvocationHandler(Invoker<?> handler) {
        this.invoker = handler;
    }

    //代理调用的实际过程
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        String methodName = method.getName(); //获取方法名
        Class<?>[] parameterTypes = method.getParameterTypes(); //方法参数类型
        if (method.getDeclaringClass() == Object.class) {
            //判断方法是不是属于Object类的方法。比如getClass、clone、notify等方法。如果是的话直接委托给invoker本身去执行。
            return method.invoke(invoker, args);
        }
        if ("toString".equals(methodName) && parameterTypes.length == 0) {
            //如果重写了toString方法。则调用invoker的toString
            return invoker.toString();
        }
        if ("hashCode".equals(methodName) && parameterTypes.length == 0) {
            //如果重写了hashCode方法。则调用invoker的hashCode
            return invoker.hashCode();
        }
        if ("equals".equals(methodName) && parameterTypes.length == 1) {
            //如果重写了equals方法。则调用invoker的equals
            return invoker.equals(args[0]);
        }
        //否则，通过method和args创建一个RpcInvocation。通过该Invocation去执行invoker调用。并且返回调用结果
        return invoker.invoke(new RpcInvocation(method, args)).recreate();
    }

}
```

##### 可以看到，jdk的实现方式很简单，只是将实际执行对象由我们平时的实际类指向了invoker

### getInvoker
```java
public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                Method method = proxy.getClass().getMethod(methodName, parameterTypes);
                return method.invoke(proxy, arguments);
            }
        };
    }
```

##### getInvoker方法通过实际执行方法和类去创建一个Invoker。JDK实现方式是创建一个匿名AbstractProxyInvoker类，并实现其doInvoke方法。doInvoke方法中通过反射获取到目标方法。然后再通过反射去执行。

##### 查看AbstractProxyInvoker类，会发现doInvoke是invoke的实际实现。因此对于代理的整个初始化流程：
1. 拿到实际执行对象，通过该对象去创建Invoker
2. 通过Invoker再去创建代理对象

## javassist实现方式
```java
public class JavassistProxyFactory extends AbstractProxyFactory {

    @SuppressWarnings("unchecked")
    public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.getProxy(interfaces).newInstance(new InvokerInvocationHandler(invoker));
    }

    public <T> Invoker<T> getInvoker(T proxy, Class<T> type, URL url) {
        // TODO Wrapper cannot handle this scenario correctly: the classname contains '$'
        final Wrapper wrapper = Wrapper.getWrapper(proxy.getClass().getName().indexOf('$') < 0 ? proxy.getClass() : type);
        return new AbstractProxyInvoker<T>(proxy, type, url) {
            @Override
            protected Object doInvoke(T proxy, String methodName,
                                      Class<?>[] parameterTypes,
                                      Object[] arguments) throws Throwable {
                return wrapper.invokeMethod(proxy, methodName, parameterTypes, arguments);
            }
        };
    }

}
```
### getProxy
```java
public <T> T getProxy(Invoker<T> invoker, Class<?>[] interfaces) {
        return (T) Proxy.getProxy(interfaces).newInstance(new InvokerInvocationHandler(invoker));
    }
```

##### 和jdk的生成方式差不多，但是这里的Proxy不是jdk自带的类，而是**com.alibaba.dubbo.common.bytecode.Proxy**，该类的主要作用就是通过javassist的字节码技术去动态的创建代理类，下面我们来看下该类的主要实现方法：
```java
public static Proxy getProxy(ClassLoader cl, Class<?>... ics) {
        if (ics.length > 65535)
            throw new IllegalArgumentException("interface limit exceeded");

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ics.length; i++) {
            String itf = ics[i].getName();
            if (!ics[i].isInterface())
                throw new RuntimeException(itf + " is not a interface.");

            Class<?> tmp = null;
            try {
                tmp = Class.forName(itf, false, cl);
            } catch (ClassNotFoundException e) {
            }

            if (tmp != ics[i])
                throw new IllegalArgumentException(ics[i] + " is not visible from class loader");

            sb.append(itf).append(';');
        }

        // use interface class name list as key.
        String key = sb.toString();

        // get cache by class loader.
        Map<String, Object> cache;
        synchronized (ProxyCacheMap) {
            cache = ProxyCacheMap.get(cl);
            if (cache == null) {
                cache = new HashMap<String, Object>();
                ProxyCacheMap.put(cl, cache);
            }
        }

        Proxy proxy = null;
        synchronized (cache) {
            do {
                Object value = cache.get(key);
                if (value instanceof Reference<?>) {
                    proxy = (Proxy) ((Reference<?>) value).get();
                    if (proxy != null)
                        return proxy;
                }

                if (value == PendingGenerationMarker) {
                    try {
                        cache.wait();
                    } catch (InterruptedException e) {
                    }
                } else {
                    cache.put(key, PendingGenerationMarker);
                    break;
                }
            }
            while (true);
        }

        long id = PROXY_CLASS_COUNTER.getAndIncrement();
        String pkg = null;
        ClassGenerator ccp = null, ccm = null;
        try {
            ccp = ClassGenerator.newInstance(cl);

            Set<String> worked = new HashSet<String>();
            List<Method> methods = new ArrayList<Method>();

            for (int i = 0; i < ics.length; i++) {
                if (!Modifier.isPublic(ics[i].getModifiers())) {
                    String npkg = ics[i].getPackage().getName();
                    if (pkg == null) {
                        pkg = npkg;
                    } else {
                        if (!pkg.equals(npkg))
                            throw new IllegalArgumentException("non-public interfaces from different packages");
                    }
                }
                ccp.addInterface(ics[i]);

                for (Method method : ics[i].getMethods()) {
                    String desc = ReflectUtils.getDesc(method);
                    if (worked.contains(desc))
                        continue;
                    worked.add(desc);

                    int ix = methods.size();
                    Class<?> rt = method.getReturnType();
                    Class<?>[] pts = method.getParameterTypes();

                    StringBuilder code = new StringBuilder("Object[] args = new Object[").append(pts.length).append("];");
                    for (int j = 0; j < pts.length; j++)
                        code.append(" args[").append(j).append("] = ($w)$").append(j + 1).append(";");
                    code.append(" Object ret = handler.invoke(this, methods[" + ix + "], args);");
                    if (!Void.TYPE.equals(rt))
                        code.append(" return ").append(asArgument(rt, "ret")).append(";");

                    methods.add(method);
                    ccp.addMethod(method.getName(), method.getModifiers(), rt, pts, method.getExceptionTypes(), code.toString());
                }
            }

            if (pkg == null)
                pkg = PACKAGE_NAME;

            // create ProxyInstance class.
            String pcn = pkg + ".proxy" + id;
            ccp.setClassName(pcn);
            ccp.addField("public static java.lang.reflect.Method[] methods;");
            ccp.addField("private " + InvocationHandler.class.getName() + " handler;");
            ccp.addConstructor(Modifier.PUBLIC, new Class<?>[]{InvocationHandler.class}, new Class<?>[0], "handler=$1;");
            ccp.addDefaultConstructor();
            Class<?> clazz = ccp.toClass();
            clazz.getField("methods").set(null, methods.toArray(new Method[0]));

            // create Proxy class.
            String fcn = Proxy.class.getName() + id;
            ccm = ClassGenerator.newInstance(cl);
            ccm.setClassName(fcn);
            ccm.addDefaultConstructor();
            ccm.setSuperClass(Proxy.class);
            ccm.addMethod("public Object newInstance(" + InvocationHandler.class.getName() + " h){ return new " + pcn + "($1); }");
            Class<?> pc = ccm.toClass();
            proxy = (Proxy) pc.newInstance();
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage(), e);
        } finally {
            // release ClassGenerator
            if (ccp != null)
                ccp.release();
            if (ccm != null)
                ccm.release();
            synchronized (cache) {
                if (proxy == null)
                    cache.remove(key);
                else
                    cache.put(key, new WeakReference<Proxy>(proxy));
                cache.notifyAll();
            }
        }
        return proxy;
    }
```

##### 该方法通过ClassLoader和Class接口生成一个Proxy类（注意是Proxy类，而不是之前的getProxy的泛型T类，实际上该Proxy就是该方法所处的类） 代码比较长，说下它的实现过程：
1. 遍历所有入参接口，以;分割连接起来，以它为key以map为缓存查找如果有，说明代理对象已创建返回
2.
