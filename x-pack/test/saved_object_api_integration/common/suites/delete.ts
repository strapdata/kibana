/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from 'expect.js';
import { SuperTest } from 'supertest';
import { DEFAULT_SPACE_ID } from '../../../../plugins/spaces/common/constants';
import { getIdPrefix, getUrlPrefix } from '../lib/space_test_utils';
import { DescribeFn, TestDefinitionAuthentication } from '../lib/types';

interface DeleteTest {
  statusCode: number;
  response: (resp: any) => void;
}

interface DeleteTests {
  spaceAware: DeleteTest;
  notSpaceAware: DeleteTest;
  invalidId: DeleteTest;
}

interface DeleteTestDefinition {
  auth?: TestDefinitionAuthentication;
  spaceId?: string;
  tests: DeleteTests;
}

export function deleteTestSuiteFactory(esArchiver: any, supertest: SuperTest<any>) {
  const createExpectLegacyForbidden = (username: string) => (resp: any) => {
    expect(resp.body).to.eql({
      statusCode: 403,
      error: 'Forbidden',
      // eslint-disable-next-line max-len
      message: `action [indices:data/write/delete] is unauthorized for user [${username}]: [security_exception] action [indices:data/write/delete] is unauthorized for user [${username}]`,
    });
  };

  const createExpectNotFound = (spaceId: string, type: string, id: string) => (resp: any) => {
    expect(resp.body).to.eql({
      statusCode: 404,
      error: 'Not Found',
      message: `Saved object [${type}/${getIdPrefix(spaceId)}${id}] not found`,
    });
  };

  const createExpectRbacForbidden = (type: string) => (resp: any) => {
    expect(resp.body).to.eql({
      statusCode: 403,
      error: 'Forbidden',
      message: `Unable to delete ${type}, missing action:saved_objects/${type}/delete`,
    });
  };

  const createExpectUnknownDocNotFound = (spaceId: string = DEFAULT_SPACE_ID) => (resp: any) => {
    createExpectNotFound(spaceId, 'dashboard', `not-a-real-id`)(resp);
  };

  const expectEmpty = (resp: any) => {
    expect(resp.body).to.eql({});
  };

  const expectRbacInvalidIdForbidden = createExpectRbacForbidden('dashboard');

  const expectRbacNotSpaceAwareForbidden = createExpectRbacForbidden('globaltype');

  const expectRbacSpaceAwareForbidden = createExpectRbacForbidden('dashboard');

  const makeDeleteTest = (describeFn: DescribeFn) => (
    description: string,
    definition: DeleteTestDefinition
  ) => {
    const { auth = {}, spaceId = DEFAULT_SPACE_ID, tests } = definition;

    describeFn(description, () => {
      before(() => esArchiver.load('saved_objects/spaces'));
      after(() => esArchiver.unload('saved_objects/spaces'));

      it(`should return ${tests.spaceAware.statusCode} when deleting a space-aware doc`, async () =>
        await supertest
          .delete(
            `${getUrlPrefix(spaceId)}/api/saved_objects/dashboard/${getIdPrefix(
              spaceId
            )}be3733a0-9efe-11e7-acb3-3dab96693fab`
          )
          .auth(auth.username, auth.password)
          .expect(tests.spaceAware.statusCode)
          .then(tests.spaceAware.response));

      it(`should return ${
        tests.notSpaceAware.statusCode
      } when deleting a non-space-aware doc`, async () =>
        await supertest
          .delete(
            `${getUrlPrefix(
              spaceId
            )}/api/saved_objects/globaltype/8121a00-8efd-21e7-1cb3-34ab966434445`
          )
          .auth(auth.username, auth.password)
          .expect(tests.notSpaceAware.statusCode)
          .then(tests.notSpaceAware.response));

      it(`should return ${tests.invalidId.statusCode} when deleting an unknown doc`, async () =>
        await supertest
          .delete(
            `${getUrlPrefix(spaceId)}/api/saved_objects/dashboard/${getIdPrefix(
              spaceId
            )}not-a-real-id`
          )
          .auth(auth.username, auth.password)
          .expect(tests.invalidId.statusCode)
          .then(tests.invalidId.response));
    });
  };

  const deleteTest = makeDeleteTest(describe);
  // @ts-ignore
  deleteTest.only = makeDeleteTest(describe.only);

  return {
    createExpectLegacyForbidden,
    createExpectUnknownDocNotFound,
    deleteTest,
    expectEmpty,
    expectRbacInvalidIdForbidden,
    expectRbacNotSpaceAwareForbidden,
    expectRbacSpaceAwareForbidden,
  };
}