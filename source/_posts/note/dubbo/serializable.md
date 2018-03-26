---
layout: post
title: dubbo-各种序列方式的比较
date: 2018/03/26
tag: [[java, java], [dubbo, dubbo]]
original: true
---

### 扩展说明
##### 将对象转成字节流，用于网络传输，以及将字节流转为对象，用于在收到字节流数据后还原成对象。

### 扩展接口
* `com.alibaba.dubbo.common.serialize.Serialization`
* com.alibaba.dubbo.common.serialize.ObjectInput

### 使用配置
```xml
<dubbo:provider serialization="" />
```
<!--more-->

### 目前已知扩展：
* fastjson=com.alibaba.dubbo.common.serialize.fastjson.FastJsonSerialization
* fst=com.alibaba.dubbo.common.serialize.fst.FstSerialization
* hessian2=com.alibaba.dubbo.common.serialize.hessian2.Hessian2Serialization
* java=com.alibaba.dubbo.common.serialize.java.JavaSerialization
* compactedjava=com.alibaba.dubbo.common.serialize.java.CompactedJavaSerialization
* nativejava=com.alibaba.dubbo.common.serialize.nativejava.NativeJavaSerialization
* kryo=com.alibaba.dubbo.common.serialize.kryo.KryoSerialization

### Serialization
```java
@SPI("hessian2") //默认实现方式为hessian2
public interface Serialization {

    /**
     * 返回序列化方式id，该id每种实现都是写死的
     */
    byte getContentTypeId();

    /**
     * 返回字符串形式的序列化类型
     */
    String getContentType();

    /**
     * 创建序列化工具ObjectOutput
     * com.alibaba.dubbo.common.serialize.ObjectOutput
     */
    @Adaptive
    ObjectOutput serialize(URL url, OutputStream output) throws IOException;

    /**
     * 创建反序列化工具ObjectOutput
     * com.alibaba.dubbo.common.serialize.ObjectInput
     */
    @Adaptive
    ObjectInput deserialize(URL url, InputStream input) throws IOException;

}
```

##### 可以看到上面的序列化过程主要是交给了ObjectOutput和ObjectInput。我们来看下他们分别是什么样的

### ObjectOutput、DataOutput
```java
public interface ObjectOutput extends DataOutput {

    /**
     * write object.
     */
    void writeObject(Object obj) throws IOException;
}
```

#### 继承了DataOutput：
```java
public interface DataOutput {

    /**
     * Write boolean.
     *
     * @param v value.
     * @throws IOException
     */
    void writeBool(boolean v) throws IOException;

    /**
     * Write byte.
     *
     * @param v value.
     * @throws IOException
     */
    void writeByte(byte v) throws IOException;

    /**
     * Write short.
     *
     * @param v value.
     * @throws IOException
     */
    void writeShort(short v) throws IOException;

    /**
     * Write integer.
     *
     * @param v value.
     * @throws IOException
     */
    void writeInt(int v) throws IOException;

    /**
     * Write long.
     *
     * @param v value.
     * @throws IOException
     */
    void writeLong(long v) throws IOException;

    /**
     * Write float.
     *
     * @param v value.
     * @throws IOException
     */
    void writeFloat(float v) throws IOException;

    /**
     * Write double.
     *
     * @param v value.
     * @throws IOException
     */
    void writeDouble(double v) throws IOException;

    /**
     * Write string.
     *
     * @param v value.
     * @throws IOException
     */
    void writeUTF(String v) throws IOException;

    /**
     * Write byte array.
     *
     * @param v value.
     * @throws IOException
     */
    void writeBytes(byte[] v) throws IOException;

    /**
     * Write byte array.
     *
     * @param v   value.
     * @param off offset.
     * @param len length.
     * @throws IOException
     */
    void writeBytes(byte[] v, int off, int len) throws IOException;

    /**
     * Flush buffer.
     *
     * @throws IOException
     */
    void flushBuffer() throws IOException;
}
```

##### 可看到如果继承ObjectOutput，则需要实现Object的序列化，以及基础类型的序列化和String类型的序列化的实现过程

### ObjectInput、DataInput
```java
public interface ObjectInput extends DataInput {

    /**
     * read object.
     */
    Object readObject() throws IOException, ClassNotFoundException;

    /**
     * read object.
     */
    <T> T readObject(Class<T> cls) throws IOException, ClassNotFoundException;

    /**
     * read object.
     */
    <T> T readObject(Class<T> cls, Type type) throws IOException, ClassNotFoundException;

}
```

```java
public interface DataInput {

    /**
     * Read boolean.
     *
     * @return boolean.
     * @throws IOException
     */
    boolean readBool() throws IOException;

    /**
     * Read byte.
     *
     * @return byte value.
     * @throws IOException
     */
    byte readByte() throws IOException;

    /**
     * Read short integer.
     *
     * @return short.
     * @throws IOException
     */
    short readShort() throws IOException;

    /**
     * Read integer.
     *
     * @return integer.
     * @throws IOException
     */
    int readInt() throws IOException;

    /**
     * Read long.
     *
     * @return long.
     * @throws IOException
     */
    long readLong() throws IOException;

    /**
     * Read float.
     *
     * @return float.
     * @throws IOException
     */
    float readFloat() throws IOException;

    /**
     * Read double.
     *
     * @return double.
     * @throws IOException
     */
    double readDouble() throws IOException;

    /**
     * Read UTF-8 string.
     *
     * @return string.
     * @throws IOException
     */
    String readUTF() throws IOException;

    /**
     * Read byte array.
     *
     * @return byte array.
     * @throws IOException
     */
    byte[] readBytes() throws IOException;
}
```
##### ObjectInput和ObjectOutput相反。做反序列化操作

##### 各种序列化的过程都是通过实现的这两个接口来实现的。这两个接口又是通过各种流的嵌套封装来完成操作的。因此后面将就这几种序列化方式做一个特点分析和各方面的比较。

## fastjson
