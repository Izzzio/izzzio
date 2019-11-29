<?php
/**
 * iZ³ | Izzzio blockchain - https://izzz.io
 * @author: Andrey Nedobylsky (admin@twister-vl.ru)
 */

class NodeRPC
{
    private $_baseUrl = 'http://localhost:3001/';
    private $_password = '';


    const METHODS = [
        'getInfo'      => ['httpMethod' => 'get'],
        'createWallet' => ['httpMethod' => 'post'],
        'changeWallet' => ['httpMethod' => 'post'],
    ];


    /**
     * cURL request
     * @param string $method
     * @param string $url
     * @param array $params
     * @return mixed|string
     */
    private static function curlRequest($method = 'get', $url, $params = [], $password = '')
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, 1);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params, '', '&'));
        }


        if (!empty($password)) {
            curl_setopt($ch, CURLOPT_USERPWD, '1337' . ":" . $password);
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 0);
        curl_setopt($ch, CURLOPT_TIMEOUT, 0);
        $response = curl_exec($ch);


        if ($response === false) {
            $response = curl_error($ch);
        }

        curl_close($ch);

        return $response;
    }

    /**
     * Make RPC request
     * @param string $method
     * @param array $params
     * @param string $paramStr
     * @return array|mixed
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    protected function request($method, $params = [], $paramStr = '')
    {
        if (empty(static::METHODS[$method])) {
            throw new InvalidMethodException('Invalid method ' . $method);
        }

        $responseBody = static::curlRequest(static::METHODS[$method]['httpMethod'], $this->_baseUrl . $method . $paramStr, $params, $this->_password);
        if (in_array(strtolower($responseBody), ['true', 'false'])) {
            if (strtolower($responseBody) === 'true') {
                return ['status' => 'ok'];
            } else {
                throw new ReturnException('Can\'t call method ' . $method);
            }
        }
        $response = json_decode($responseBody, true);
        if (!is_array($response)) {
            throw new RpcCallException('RPC Error: ' . $responseBody);
        }

        return $response;
    }

    /**
     * BitcoenRPC constructor.
     * @param string $RPCUrl
     * @param string $password
     */
    public function __construct($RPCUrl = 'http://localhost:3001/', $password = '')
    {
        $this->_baseUrl = $RPCUrl;
        $this->_password = $password;

        return $this;
    }

    /**
     * Returns current blockchain status and node info
     * @return mixed
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    public function getInfo()
    {
        return $this->request('getInfo');
    }

    /**
     * Generate and register new wallet with id, block id, private and public keysPair
     * @return mixed
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    public function createWallet()
    {
        return $this->request('createWallet');
    }

    /**
     * Change current wallet for node. The transactions list was recalculated Which can take a long time
     * @param string $id Full wallet address
     * @param string $private Private key
     * @param string $public Public key
     * @return array
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    public function changeWalletByData($id, $private, $public)
    {
        if ($this->getWallet() === $id) {
            return ['status' => 'ok'];
        }

        return $this->request('changeWallet', [
            'id'      => $id,
            'public'  => $public,
            'private' => $private,
            'balance' => 0,
        ]);
    }

    /**
     * Change current wallet for node. The transactions list was recalculated Which can take a long time
     * @param array $wallet Array returned from create wallet method
     * @return array
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    public function changeWallet($wallet)
    {
        return $this->changeWalletByData($wallet['id'], $wallet['keysPair']['private'], $wallet['keysPair']['public']);
    }

    /**
     * Get current wallet address
     * @return mixed
     * @throws InvalidMethodException
     * @throws ReturnException
     * @throws RpcCallException
     */
    public function getWallet()
    {
        return $this->getInfo()['wallet']['id'];
    }

}

class InvalidMethodException extends Exception
{
}

class RpcCallException extends Exception
{
}

class ReturnException extends Exception
{
}