# Minimal in-memory stand-in for the redis-rb client surface LinkStore uses.
# TTLs are recorded but never expire — the specs only assert what is written.
class FakeRedis
  attr_reader :ttls

  def initialize
    @data = {}
    @ttls = {}
  end

  def set(key, value, ex: nil)
    @data[key] = value
    @ttls[key] = ex
  end

  def get(key)
    @data[key]
  end

  def del(key)
    @data.delete(key)
    @ttls.delete(key)
  end
end

# Connection-pool shaped wrapper (responds to #with), so the specs can cover
# both injection styles LinkStore accepts.
class FakeRedisPool
  def initialize(client)
    @client = client
  end

  def with
    yield @client
  end
end
